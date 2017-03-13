"use strict";


var fs = require("fs-extra");
var chalk = require("chalk");
var partialUtils = require("./utils/partials");
var Handlebars = require("handlebars");
var glob = require("glob");
var path = require("path");


// export Handlebars for easy access in helpers
HandlebarsPlugin.Handlebars = Handlebars;


function getHelperId(filepath) {
    var id = filepath.match(/\/([^\/]*).js$/).pop();
    return id.replace(/\.?helper\.?/, "");
}


function addHelper(Handlebars, id, fun) {
    console.log(chalk.grey("HandlebarsPlugin: registering helper " + id));
    Handlebars.registerHelper(id, fun);
}

function HandlebarsPlugin(options) {
    if (options.onBeforeSetup) {
        options.onBeforeSetup(Handlebars);
    }

    this.options = options;
    this.outputFile = options.output;
    this.entryFile = options.entry;
    this.data = options.data || {};
    this.fileDependencies = [];

    // register helpers
    var self = this;
    var helperQueries = options.helpers || {};
    Object.keys(helperQueries).forEach(function (helperId) {
        var foundHelpers;

        // globbed paths
        if (typeof helperQueries[helperId] === "string") {
            foundHelpers = glob.sync(helperQueries[helperId]);
            foundHelpers.forEach(function (pathToHelper) {
                addHelper(Handlebars, getHelperId(pathToHelper), require(pathToHelper));
                self.addDependency(pathToHelper);
            });

        // functions
        } else {
            addHelper(Handlebars, helperId, helperQueries[helperId]);
        }
    });
}

HandlebarsPlugin.Handlebars = Handlebars;

HandlebarsPlugin.prototype.readFile = function (filepath) {
    this.fileDependencies.push(filepath);
    return fs.readFileSync(filepath, "utf-8");
};

HandlebarsPlugin.prototype.addDependency = function () {
    this.fileDependencies.push.apply(this.fileDependencies, arguments);
};

HandlebarsPlugin.prototype.apply = function (compiler) {
    var self = this;
    var options = this.options;
    var data = this.data;
    var entryFile = this.entryFile;
    var outputFile = this.outputFile;

    compiler.plugin("compile", function (object, done) {
        var templateContent;
        var template;
        var result;
        var partials;

        // fetch paths to partials
        partials = partialUtils.loadMap(Handlebars, options.partials);

        if (options.onBeforeAddPartials) {
            options.onBeforeAddPartials(Handlebars, partials);
        }
        // register partials
        partialUtils.addMap(Handlebars, partials);
        // watch all partials for changes
        self.addDependency.apply(self, Object.keys(partials).map(function (key) {return partials[key]; }) );


        glob(entryFile, {}, (err, entryFilesArray)=>{
            if (err) { console.log(err);return false; }

            entryFilesArray.forEach((entryFileSingle, i)=>{

                templateContent = self.readFile(entryFileSingle, "utf-8");
                let fileName = path.basename(entryFileSingle);
                const fileExt = path.extname(entryFileSingle);
                fileName = fileName.replace(fileExt, '');

                if (options.onBeforeCompile) {
                    templateContent = options.onBeforeCompile(Handlebars, templateContent) || templateContent;
                }
                template = Handlebars.compile(templateContent);

                if (options.onBeforeRender) {
                    data = options.onBeforeRender(Handlebars, data) || data;
                }
                result = template(data);

                if (options.onBeforeSave) {
                    result = options.onBeforeSave(Handlebars, result) || result;
                }

                const outputFileNew = outputFile.replace('[name]', fileName);
                fs.outputFileSync(outputFileNew, result, "utf-8");

                if (options.onDone) {
                    options.onDone(Handlebars);
                }
            });
        });
    });

    compiler.plugin("emit", function (compiler, done) {
        // add dependencies to watch. This might not be the correct place for that - but it works
        // webpack filters duplicates...
        compiler.fileDependencies = compiler.fileDependencies.concat(self.fileDependencies);
        done();
    });
};


module.exports = HandlebarsPlugin;
