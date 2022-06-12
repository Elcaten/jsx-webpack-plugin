const fs = require("fs-extra");
const decache = require("decache");
const React = require("react");
const chalk = require("chalk");
const glob = require("glob");
const path = require("path");
const log = require("./utils/log");
const getTargetFilepath = require("./utils/getTargetFilepath");
const sanitizePath = require("./utils/sanitizePath.js");
const getRootFolder = require("./utils/getRootFolder");
const ReactDom = require("react-dom/server");

class JSXWebpackPlugin {
    constructor(options = {}) {
        this.options = Object.assign(
            {
                entry: null,
                output: null,
                data: {},
                components: [],
                // make filepath retrieval customizable
                getTargetFilepath,
                // lifecycle hooks
                onBeforeSetup: Function.prototype,
                onBeforeRender: Function.prototype,
                onBeforeSave: Function.prototype,
                onDone: Function.prototype
            },
            options
        );

        this.firstCompilation = true;
        this.options.onBeforeSetup();
        this.fileDependencies = [];
        this.assetsToEmit = {};
        this.updateData();
        this.prevTimestamps = {};
        this.startTime = Date.now();
    }

    loadComponents() {
        if (this.options.components == null) {
            return;
        }

        let components = [];
        this.options.components.forEach((watchGlob) => {
            components = components.concat(glob.sync(watchGlob));
        });

        // watch all components for changes
        this.addDependency.apply(this, components);
    }

    /**
     * Webpack plugin hook - main entry point
     * @param  {Compiler} compiler
     */
    apply(compiler) {
        // COMPILE TEMPLATES
        const compile = (compilation, done) => {
            try {
                if (this.dependenciesUpdated(compiler) === false) {
                    return done();
                }

                this.loadComponents();
                this.compileAllEntryFiles(compilation, done); // build all html pages
            } catch (error) {
                compilation.errors.push(error);
                done();
            }
            return undefined; // done();?
        };

        // REGISTER FILE DEPENDENCIES TO WEBPACK
        const emitDependencies = (compilation, done) => {
            try {
                // resolve file paths for webpack-dev-server
                const resolvedDependencies = this.fileDependencies.map((file) =>
                    path.resolve(file)
                );
                // register dependencies at webpack
                if (compilation.fileDependencies.add) {
                    // webpack@4
                    resolvedDependencies.forEach(
                        compilation.fileDependencies.add,
                        compilation.fileDependencies
                    );
                } else {
                    compilation.fileDependencies =
                        compilation.fileDependencies.concat(
                            resolvedDependencies
                        );
                }
                // emit generated html pages (webpack-dev-server)
                this.emitGeneratedFiles(compilation);
                return done();
            } catch (error) {
                compilation.errors.push(error);
                done();
            }
            return undefined; // done();?
        };

        compiler.hooks.make.tapAsync("JSXRenderPlugin", compile);
        compiler.hooks.emit.tapAsync("JSXRenderPlugin", emitDependencies);
    }

    /**
     * Returns contents of a dependent file
     * @param  {String} filepath
     * @return {String} filecontents
     */
    readFile(filepath) {
        this.addDependency(filepath);
        return fs.readFileSync(filepath, "utf-8");
    }

    /**
     * Registers a file as a dependency
     * @param {...[String]} args    - list of filepaths
     */
    addDependency(...args) {
        if (!args) {
            return;
        }
        args.forEach((filename) => {
            filename = sanitizePath(filename);
            if (filename && !this.fileDependencies.includes(filename)) {
                this.fileDependencies.push(filename);
            }
        });
    }

    /**
     * Check if dependencies have been modified
     * @param  {Object} compiler
     * @return {Boolean} true, if a jsx file has been updated
     */
    dependenciesUpdated(compiler) {
        const modifiedFiles = compiler.modifiedFiles; // Set containing paths of modified files

        if (modifiedFiles == null) {
            // First run
            return true;
        }

        const fileDependencies = this.fileDependencies;

        for (let i = 0; i < fileDependencies.length; i++) {
            // path.resolve because paths in fileDependencies have '/' separators while paths
            // in modifiedFiles have '\' separators (on windows)
            if (modifiedFiles.has(path.resolve(fileDependencies[i]))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Notifies webpack-dev-server of generated files
     * @param  {Object} compilation
     */
    emitGeneratedFiles(compilation) {
        Object.keys(this.assetsToEmit).forEach((filename) => {
            compilation.assets[filename] = this.assetsToEmit[filename];
        });
    }

    /**
     * (Re)load input data for hbs rendering
     */
    updateData() {
        if (this.options.data && typeof this.options.data === "string") {
            try {
                const dataFromFile = JSON.parse(
                    this.readFile(this.options.data)
                );
                this.addDependency(this.options.data);
                this.data = dataFromFile;
            } catch (e) {
                console.error(
                    `Tried to read ${this.options.data} as json-file and failed. Using it as data source...`
                );
                this.data = this.options.data;
            }
        } else {
            this.data = this.options.data;
        }
    }

    /**
     * @async
     * Generates all given jsx templates
     * @param  {Object} compilation  - webpack compilation
     * @param  {Function} done
     */
    compileAllEntryFiles(compilation, done) {
        this.updateData();

        glob(this.options.entry, (globError, entryFilesArray) => {
            if (globError) {
                compilation.errors.push(globError);
                done();
                return;
            }

            try {
                if (entryFilesArray.length === 0) {
                    log(
                        chalk.yellow(
                            `no valid entry files found for ${this.options.entry} -- aborting`
                        )
                    );
                    return;
                }
                entryFilesArray.forEach((sourcePath) => {
                    try {
                        this.compileEntryFile(
                            sourcePath,
                            compilation.compiler.outputPath,
                            compilation
                        );
                    } catch (error) {
                        compilation.errors.push(
                            new Error(
                                `${sourcePath}: ${error.message}\n${error.stack}`
                            )
                        );
                        done();
                    }
                });
            } catch (error) {
                compilation.errors.push(error);
                done();
            }

            // enforce new line after plugin has finished
            console.log();

            done();
        });
    }

    /**
     * Generates the html file for the given filepath
     * @param  {String} sourcePath  - filepath to handelebars template
     * @param  {String} outputPath  - webpack output path for build results
     * @param  {Object} compilation  - webpack compilation instance
     */
    compileEntryFile(sourcePath, outputPath) {
        outputPath = sanitizePath(outputPath);

        let rootFolderName = path.dirname(sourcePath);
        if (this.options.output.includes("[path]")) {
            rootFolderName = getRootFolder(sourcePath, this.options.entry);
        }
        if (rootFolderName === false) {
            throw new Error(`${sourcePath}: is ignored`);
        }

        let targetFilepath = this.options.getTargetFilepath(
            sourcePath,
            this.options.output,
            rootFolderName
        );
        targetFilepath = sanitizePath(targetFilepath);
        this.addDependency(sourcePath);
        decache(sourcePath);
        const component = require(sourcePath).default;
        const data =
            this.options.onBeforeRender(this.data, sourcePath) || this.data;
        const element = React.createElement(component, data);
        const content = ReactDom.renderToStaticMarkup(element);
        const result =
            this.options.onBeforeSave(content, targetFilepath) || content;

        if (targetFilepath.includes(outputPath)) {
            // change the destination path relative to webpacks output folder and emit it via webpack
            targetFilepath = targetFilepath
                .replace(outputPath, "")
                .replace(/^\/*/, "");
            this.assetsToEmit[targetFilepath] = {
                source: () => result,
                size: () => result.length
            };
        } else {
            // @legacy: if the filepath lies outside the actual webpack destination folder, simply write that file.
            // There is no wds-support here, because of watched assets being emitted again
            fs.outputFileSync(targetFilepath, result, "utf-8");
        }

        this.options.onDone(targetFilepath);
        log(
            chalk.grey(
                `created output '${targetFilepath.replace(
                    `${process.cwd()}/`,
                    ""
                )}'`
            )
        );
    }
}

module.exports = JSXWebpackPlugin;
