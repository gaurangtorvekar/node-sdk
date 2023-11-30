const path = require("path");

module.exports = {
	entry: "./src/index.ts", // The entry point of your library
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "bastion-wallet.js",
		library: "BastionWallet",
		libraryTarget: "umd", // supports both CommonJS and AMD
		globalObject: "this",
		publicPath: '',
		chunkFilename: "BastionWallet.bundle.js",
	},
	resolve: {
		extensions: [".ts", ".tsx", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: "babel-loader",
				exclude: /node_modules/,
			},
		],
	},
	target: 'web',
};