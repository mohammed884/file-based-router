import express from "express";
import fs from "fs";
import path from "path";
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('app'))
// const APP_ROOT_FOLDER = path.resolve("src/app");
const APP_ROOT_FOLDER = "src/app"
const dynamicRouteChecker = async (folder) => {
    try {
        const files = await fs.promises.readdir(APP_ROOT_FOLDER + "/" + folder);
        const dynamicFileName = files.find(file => file.match(/\[[a-zA-Z0-9\._]+\]/));
        if (!dynamicFileName) return null;
        return {
            fileName: dynamicFileName,
            param: dynamicFileName.replace("[", "").replace("].js", "")
        }
    } catch (error) {
        console.log(error);
        // throw new Error;
    }
};
const sanitizePath = (userInputPath) => {
    return userInputPath.replace(/\.\.\//g, "");
};
// function mapRoutes(dirPath) {
//     let result = new Map();
//     // Read the contents of the app
//     const list = fs.readdirSync(dirPath);

//     list.forEach(file => {
//         const filePath = path.join(dirPath, file).replace(/\\/g, '\/')

//         // Check if it's a directory or a file
//         const stat = fs.statSync(filePath);
//         if (stat && stat.isDirectory()) {
//             // If it's a directory, recursively call the function
//             const nestedFiles = mapRoutes(filePath);
//             nestedFiles.forEach((value, key) => {
//                 result.set(key, value)
//             });
//         } else {
//             // If it's a file, set the file path as key and file name or stats as value
//             const dynamicRouteChecker = file.match(/\[[a-zA-Z0-9\._]+\]/);
//             const isDynamicFile = dynamicRouteChecker ? true : false;
//             const param = isDynamicFile ? dynamicRouteChecker[0].replace("[", "").replace("]", "") : ""
//             result.set(filePath, {
//                 name: file,
//                 path: filePath.replace("src", "."),
//                 isDynamicFile,
//                 param,
//                 size: stat.size,
//                 modified: stat.mtime
//             });
//         }
//     });

//     return result;
// }

// Example usage
function mapRoutes(dirPath) {
    let result = new Map();
    // Read the contents of the app
    const list = fs.readdirSync(dirPath);
    list.forEach(async file => {
        const filePath = path.join(dirPath, file).replace(/\\/g, '\/')
        const isDynamicFile = filePath.match(/\[[a-zA-Z0-9\._]+\]/);
        if (isDynamicFile) return;
        // Check if it's a directory or a file
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            // If it's a directory, recursively call the function
            const nestedFiles = mapRoutes(filePath);
            nestedFiles.forEach((value, key) => {
                result.set(key, value)
            });
        } else {
            // If it's a file, set the file path as key and file name or stats as value
            result.set(filePath, {
                name: file,
                path: filePath.replace("src", "."),
                module: import(filePath.replace("src", ".")),
                size: stat.size,
                modified: stat.mtime
            });
        }
    });

    return result;
}
const routes = mapRoutes(APP_ROOT_FOLDER);
const getRoute = async (req, res, filePath, isDynamicFile = false) => {
    try {
        console.log(filePath);
        let module;
        let file = routes.get(filePath);

        if (isDynamicFile) {
            module = await import(filePath.replace("src", "."))
        }
        else {
            module = await file.module;
        }
        const httpMethod = req.method.toLowerCase();
        if (!module) {
            return res.status(404).send("Route not found")
        }
        if (!module.handler && !module[httpMethod])
            return res.status(500).send("The router must export a handler");
        if (module.handler) {
            module.handler(req, res);
        } else {
            module[httpMethod](req, res);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send("Route not found")
    }
};
app.all("/app/*", async (req, res) => {
    try {
        let isDynamicFile = false;
        let filePath = APP_ROOT_FOLDER + sanitizePath(req.url.replace("/app", ""));
        const isFile = fs.existsSync(filePath + ".js");
        /*
        Three cases to watch for
        -route is a file
        -route is a dynamic file
        -route is a directory
        */
        if (isFile)
            filePath += ".js"
        else {
            const splitedFilePath = filePath.split("/");
            //remove src and the param value from the path;
            const folderPath = splitedFilePath.slice(2, splitedFilePath.length - 1).join("/");
            const dynamicRouteCheckResult = await dynamicRouteChecker(folderPath);
            if (dynamicRouteCheckResult && dynamicRouteCheckResult.fileName) {
                isDynamicFile = true;
                //GET THE PARAM VALUE
                const paramValue = splitedFilePath[splitedFilePath.length - 1];
                //replace the param value with the param
                filePath = filePath.replace(paramValue, dynamicRouteCheckResult.fileName);
                //set the param
                req.params[dynamicRouteCheckResult.param] = splitedFilePath[splitedFilePath.length - 1];
            }
            else {
                filePath += "/index.js";
            }
        }
        await getRoute(req, res, filePath, isDynamicFile);
    } catch (error) {
        console.log(error);
        res.status(500).send("some error occurr", error)
    }
})
app.listen(3000, (err) => {
    if (err) console.log(err)
    else console.log("Connect to port 3000...");
})