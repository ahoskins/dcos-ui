// dependencies
var assetRev = require("broccoli-asset-rev");
var autoprefixer = require("broccoli-autoprefixer");
var chalk = require("chalk");
var cleanCSS = require("broccoli-clean-css");
var env = require("broccoli-env").getEnv();
var eslint = require("broccoli-lint-eslint");
var fs = require("fs");
var less = require("broccoli-less-single");
var mergeTrees = require("broccoli-merge-trees");
var funnel = require("broccoli-funnel");
var replace = require("broccoli-replace");
var removeFile = require("broccoli-file-remover");
var uglifyJavaScript = require("broccoli-uglify-js");
var webpackify = require("broccoli-webpack");
var _ = require("underscore");
var packageConfig = require("./package.json");

/*
 * configuration
 * (use "" for root of dir)
 */
var dirs = {
  src: "src",
  js: "src/js",
  jsDist: "",
  styles: "src/styles",
  stylesDist: "",
  img: "src/img",
  imgDist: "img"
};

// without extensions
var fileNames = {
  mainJs: "main",
  mainJsDist: "main",
  mainStyles: "main",
  mainStylesDist: "main"
};

/*
 * Task definitions
 */
var tasks = {

  eslint: function (tree) {
    return eslint(tree, {config: ".eslintrc"});
  },

  webpack: function (masterTree) {
    // transform merge module dependencies into one file
    var options = {
      entry: "./" + dirs.js + "/" + fileNames.mainJs + ".js",
      output: {
        filename: dirs.jsDist + "/" + fileNames.mainJsDist + ".js"
      },
      module: {
        loaders: [
          {
            test: /\.js$/,
            loader: "jsx-loader?harmony",
            exclude: /node_modules/
          }
        ],
        postLoaders: [
          {
            loader: "transform?envify"
          }
        ]
      },
      resolve: {
        extensions: ["", ".js"]
      }
    };

    // Extend options with source mapping
    if (env === "development") {
      options.devtool = "source-map";
      options.module.preLoaders = [
        {
          test: /\.js$/,
          loader: "source-map-loader",
          exclude: /node_modules/
        }
      ];
    }

    return webpackify(masterTree, options);
  },

  minifyJs: function (masterTree) {
    return uglifyJavaScript(masterTree, {
      mangle: true,
      compress: true
    });
  },

  css: function (masterTree) {

    // create tree for less (pick all less and css files needed)
    var cssTree = funnel(dirs.styles, {
      include: ["**/*.less"],
      destDir: dirs.stylesDist
    });

    // remove old compiled file, from ealier build
    removeFile(cssTree, {
      srcFile: dirs.stylesDist + "/" + fileNames.mainStylesDist + ".css"
    });

    // compile main less to css
    var lessTree = less(
      cssTree,
      fileNames.mainStyles + ".less",
      dirs.stylesDist + "/" + fileNames.mainStylesDist + ".css",
      {}
    );

    lessTree = autoprefixer(lessTree);

    cssTree = mergeTrees([masterTree, lessTree], {overwrite: true});

    return cssTree;
  },

  minifyCSS: function (masterTree) {
    return cleanCSS(masterTree);
  },

  index: function (masterTree) {
    // create tree for index
    var indexTree = funnel(dirs.src, {
      files: ["index.html"]
    });

    indexTree = replace(indexTree, {
      files: ["index.html"],
      patterns: [
        {
          match: "ANALYTICS_KEY",  // replaces @@ANALYTICS_KEY
          replacement: env === "production" ?
            "51ybGTeFEFU1xo6u10XMDrr6kATFyRyh" :
            "39uhSEOoRHMw6cMR6st9tYXDbAL3JSaP"
        }
      ]
    });

    return mergeTrees(
      [masterTree, indexTree],
      {overwrite: true}
    );
  },

  img: function (masterTree) {
    // create tree for image files
    var imgTree = funnel(dirs.img, {
      exclude: [new RegExp(/_export/)],
      destDir: dirs.imgDist
    });

    return mergeTrees(
      [masterTree, imgTree],
      {overwrite: true}
    );
  },

  swf: function (masterTree) {
    var swfTree = funnel(dirs.src, {
      files: ["ZeroClipboard.swf"]
    });

    return mergeTrees(
      [masterTree, swfTree],
      {overwrite: true}
    );
  },

  md5: function (masterTree) {
    // add md5 checksums to filenames
    return assetRev(masterTree, {
      extensions: ["js", "css", "png", "jpg", "gif", "swf"],
      replaceExtensions: ["html", "js", "css", "swf"]
    });
  }
  // https://github.com/bguiz/broccoli-sprite
  // https://github.com/imagemin/imagemin
};

/*
 * basic pre-processing before actual build
 */
function createJsTree() {
  // create tree for .js
  var jsTree = funnel(dirs.js, {
    include: ["**/*.js"],
    destDir: dirs.js
  });

  // replace @@ENV in js code with current BROCCOLI_ENV environment variable
  // {default: "development" | "production"}
  return replace(jsTree, {
    files: ["**/*.js"],
    patterns: [
      {
        match: "ENV", // replaces @@ENV
        replacement: env
      },
      {
        match: "VERSION",
        replacement: packageConfig.version
      }
    ]
  });
}

/*
 * Check if development environment is properly setup
 */
if (env === "development") {
  try {
    // Query the entry
    fs.lstatSync("src/js/config/Config.dev.js");
  }
  catch (err) {
    err.message = chalk.red("Please copy 'src/js/config/Config.template.js' " +
      "to 'src/js/config/Config.dev.js' and make necessary changes " +
      "to start working on assets.");
    throw err;
  }
}
/*
 * Start the build
 */
var buildTree = _.compose(tasks.eslint, createJsTree);

// export BROCCOLI_ENV={default : "development" | "production"}
if (env === "development" || env === "production" ) {
  // add steps used in both development and production
  buildTree = _.compose(
    tasks.swf,
    tasks.img,
    tasks.index,
    tasks.css,
    tasks.webpack,
    buildTree
  );
}

if (env === "production") {
  // add steps that are exclusively used in production
  buildTree = _.compose(
    tasks.md5,
    tasks.minifyCSS,
    tasks.minifyJs,
    buildTree
  );
}

module.exports = buildTree();
