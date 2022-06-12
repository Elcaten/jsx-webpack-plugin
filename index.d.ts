import { Compiler, WebpackPluginInstance } from "webpack";

declare class JSXWebpackPlugin implements WebpackPluginInstance {
    constructor(options?: JSXWebpackPlugin.PluginOptions);

    /**
     * Apply the plugin
     */
    apply(compiler: Compiler): void;
}

declare namespace JSXWebpackPlugin {
    /**
     * Type for the object partials that the plugin creates in other to process all partials
     */
    interface PartialsMap {
        [partial: string]: string;
    }

    /**
     * Handlebars Webpack Plugin Options
     */
    interface PluginOptions {
        /**
         * Path to hbs entry file(s).
         * Also supports nested directories if write
         * path.join(process.cwd(), "app", "src", "**", "*.hbs"),
         */
        entry?: string | undefined;

        /**
         * Output path and filename(s).
         * This should lie within the webpacks output-folder
         * if omitted, the input filepath stripped of its extension will be used
         */
        output?: string | undefined;

        /**
         * You can also add a [path] variable, which will emit the files with their
         * relative path, like output:
         * path.join(process.cwd(), "build", [path], "[name].html
         *
         * data passed to main hbs template: `main-template(data)`
         */
        data?: object | string | undefined;

        /**
         * Modify the default output path of each entry-template
         */
        getTargetFilepath?:
            | ((
                  filepath: string,
                  outputTemplate: string,
                  rootFolder: string
              ) => string | undefined)
            | undefined;

        /**
         * onBeforeSetup hook, runs before setup of the plugin
         */
        onBeforeSetup?: (() => any) | undefined;

        /**
         * onBeforeRender hook, runs before rendering of the templates
         */
        onBeforeRender?: ((data: object, filename: string) => any) | undefined;

        /**
         * onBeforeSave hook, runs before saving
         */
        onBeforeSave?:
            | ((resultHtml: string, filename: string) => any)
            | undefined;

        /**
         * onDone, runs before the final stages of the plugin
         */
        onDone?: ((filename: string) => any) | undefined;

        /**
         * globbed path to components to watch for changes
         */
        components?: string[] | undefined;
    }
}

export = JSXWebpackPlugin;
