<h1 align="center"><img src="./docs/jsx-wp-plugin.svg" width="276" alt="handlebars webpack plugin"></h1>

> Server-side template rendering using JSX

`npm install react react-dom @babel/core @babel/preset-env @babel/preset-react jsx-webpack-plugin --save-dev`

## Usage

In your webpack config register and setup the jsx plugin

```javascript
const path = require("path");
const JSXPlugin = require("jsx-webpack-plugin");

const webpackConfig = {
    plugins: [
        new JSXPlugin({
            // path to hbs entry file(s). Also supports nested directories if write path.join(process.cwd(), "app", "src", "**", "*.jsx"),
            entry: path.join(process.cwd(), "app", "src", "*.jsx"),
            // output path and filename(s). This should lie within the webpacks output-folder
            // if ommited, the input filepath stripped of its extension will be used
            output: path.join(process.cwd(), "build", "[name].html"),
            // you can also add a [path] variable, which will emit the files with their relative path, like
            // output: path.join(process.cwd(), "build", [path], "[name].html"),

            // globbed path to components to watch for changes
            partials: [
                path.join(
                    process.cwd(),
                    "app",
                    "src",
                    "components",
                    "*",
                    "*.jsx"
                ),
            ],

            // hooks
            // getTargetFilepath: function (filepath, outputTemplate) {},
            // getPartialId: function (filePath) {}
            onBeforeSetup: function () {},
            onBeforeRender: function (data, filename) {},
            onBeforeSave: function (resultHtml, filename) {},
            onDone: function (filename) {},
        }),
    ],
};
```

## Options

### target filepaths

Per default, the generated filepath of the html-results is defined by the `output`-property in the plugin-options. To changed the output folder and name, you can pass your custom filepath-helper to the plugin-options like

```javascript
{
    /**
     * Modify the default output path of each entry-template
     * @param {String} filepath     - the source of the template
     * @param {String} outputTemplate - the filepath template defined in `output`
     * @param {String} rootFolder   - the filepaths rootFolder
     * @return {String} final path, where the rendered html-file should be saved
     */
    getTargetFilepath: function getTargetFilepath(
        filepath,
        outputTemplate,
        rootFolder
    ) {
        const fileName = path
            .basename(filepath)
            .replace(path.extname(filepath), "");
        return outputTemplate.replace("[name]", fileName);
    }
}
```

You can find the default implementation in [utils/getTargetFilepath](./utils/getTargetFilepath.js).
