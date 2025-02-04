const path = require("path");
const nodeExternals = require('webpack-node-externals');

module.exports = {
	entry: "./src/index.ts", // The entry point of your library
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "bastion-wallet.js",
		library: "BastionWallet",
		libraryTarget: "umd", // supports both CommonJS and AMD
		globalObject: "this",
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
	target: 'node',
	externals: [nodeExternals()],
};