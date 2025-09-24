import fs from "fs";
import express from "express";
import Connector from './Connector.mjs';
import path from "path";
import {fileURLToPath} from "url";
import jsonic from "jsonic"
import IdForge from "./components/IdForge.mjs"

class Module {
    constructor(connector,metaUrl) {
        this.connector = connector
        if (metaUrl) {
            this.rootPath = path.dirname(fileURLToPath(metaUrl));
            let parts = this.rootPath.split('/')
            this.moduleName = parts[parts.length-1];
            this.loadComponents();
        }
    }

    /**
     * Every module may offer a folder of client UI components. These
     * components are available to all other modules. Modules loaded
     * later in the init list may override components from previous
     * modules.
     * @returns void
     */
    loadComponents() {
        this.components = {};
        try {
            let files = fs.readdirSync(this.rootPath+"/components");
            for (let comp of files) this.components[comp] = this.rootPath+"/components/"+comp;
        } catch(e) {}
    }

    /**
     * Override to include paths to packages in node-modules. For example
     * {'moment':'/moment/min/moment-with-locales.min.js'}
     * enables client side scripts to import `/lib/moment`.
     * @returns {{}}
     */
    get library() {
        return {};
    }

    /**
     * Each module can inject assets into the common page harness (images, fonts, css)
     * @returns {string[]}
     */
    get assets() {
        return [];
    }

    /**
     * Provide fully qualified paths to the library files
     * @returns {string[]}
     */
    get absoluteLibrary() {
        if (!this.rootPath) return {};
        return Object.entries(this.library).reduce((result,[key,value])=>{
            result[key] = this.rootPath+"/node_modules"+value;
            return result;
        },{})
    }
}
class ComponentryModule extends Module {
    constructor(connector) {
        super(connector,import.meta.url);
    }
}

export default class Componentry {
    constructor(app,profile,options) {
        this.profile = profile;
        this.options = options||{};
        this.modules = {};
        this.components = {};
        this.library = {};
        this.app = app;
        this.assets = [];
    }

    /**
     * Modules loaded by componentry should extend Componentry.Module;
     * @type {*}
     */
    static Module = Module;

    /**
     * Expose the common id generator. IdForge provides datedId() and randomId()
     @type {*}
     */
    static get IdForge() {
        return IdForge;
    }
    get IdForge() {
        return Componentry.IdForge;
    }
    /**
     * Expose the connector for API clients
     * @type {*}
     */
    static get Connector() {
        return Connector;
    }
    /**
     * Load modules and their components.
     * Components are served after acl is applied. Modules can overwrite components
     * loaded in earlier in init().
     * Lib files allow node_modules to be extended to the browser with /lib
     * If a component includes and "assets" folder this is routed as a static link
     * in the form /componentClassName/assets/fileName. CSS files are additionally linked
     * from the app index.html header to be available throughout the app.
     * @returns {Promise<void>}
     */
    async init() {
        this.connector = await Connector.mint(this);
        // From arguments load modules, their components, routes and library
        let modules = Array.from(arguments);
        modules.unshift(ComponentryModule);
        for (let module of modules) {
            let instance = await module.mint?(await module.mint(this.connector, this.options)):(new module(this.connector, this.options));
            this.modules[module.name] = instance;
            let assetsFolderName = instance.rootPath+'/assets'
            let assetsFolder = fs.existsSync(assetsFolderName)?fs.readdirSync(assetsFolderName):[];
            if (fs.existsSync(instance.rootPath+'/package.json')) {
                let text = await fs.readFileSync(instance.rootPath+'/package.json');
                let packageJson = JSON.parse(text.toString());
                for (let asset of assetsFolder) {
                    let type = asset.match(/\.([a-z0-9]*$)/)
                    this.assets.push({
                        fileName:asset,
                        moduleName:packageJson.name.replace(/^\@[A-Za-z0-9.\-_]+\//,""),
                        path:instance.rootPath+'/assets/'+asset,
                        type:type?type[1]:null
                    })
                }
            }
            if (instance.components) Object.assign(this.components,instance.components);
            if (instance.routes) this.app.use(instance.routes());
            if (instance.library) Object.assign(this.library,instance.absoluteLibrary);
        }

        for (let module of Object.values(this.modules)) {
            try {
                if (module.postMint) await module.postMint();
            } catch(e) {
                console.warn(`Module ${module.name}.postMint failed with ${e.message}`);
            }
        }
        // note the routes need the combined object set. The componentry module is only itself.
        this.app.use(this.routes());
    }

    /**
     * Componentry provides the core web requests for fetching components and styles.
     * It is itself a component.
     */
    routes() {
        let router = express.Router();
        /**
         * Used by the browser code to import components
         */
        router.use('/components/:component',(req,res)=>{
            let level = req.account?(req.account.super?5:req.account.level)||0:0;
            res.set("Content-Type","text/javascript");
            let js = fs.readFileSync(this.components[req.params.component]).toString();
            js = js.replace(/\/\*ACL([<>]{1})(\d){1}\*\/(.*?)\/\*ENDACL\*\//gs,(match,op,acl,code)=>{
                acl = parseInt(acl);
                if (op==='>'?level>acl:level<acl) return code;
                else return "";
            });
            res.send(js);
        });
        /**
         * Components CSS merges the CSS files of all components referenced by the client
         */
        router.use('/styles/component.css',(req,res)=>{
            let sheets = Object.keys(this.components).filter(fn => fn.endsWith('.css'));
            let css = sheets.reduce((r,name)=>{
                let sheet = fs.readFileSync(this.components[name]).toString();
                sheet = sheet.replace(/(^[A-Za-z>.#*:].*){/mg,(base)=>{
                    base = base.split(',');
                    return base.map(b=>"."+name.slice(0,-4)+" "+b.replace(/^\.([\W]*{)/,"$1"))
                });
                // begin line with a carat to declare global styles
                sheet = sheet.replace(/^\^\s*/mg,'');
                return r+sheet+"\n";
            },"");
            res.set("Content-Type","text/css");
            res.send(css);
        });
        router.get('/styles/static.css',(req,res)=>{
            try {
                let css = "";
                for (let s of this.assets.filter(record=>record.type==='css')) {
                    let txt = fs.readFileSync(s.path).toString();
                    css += `\n/* ${s.moduleName} */\n`+txt;
                }
                res.set("Content-Type","text/css");
                res.send(css);
            } catch(e) {
                console.log(e.message)
                res.status(404).send();
            }
        })
        router.get('/:module/assets/:file',(req,res)=>{
            let asset = this.assets.find(asset => asset.moduleName.toLowerCase() === req.params.module.toLowerCase()
                && asset.fileName.toLowerCase() === req.params.file.toLowerCase());
            if (asset) res.sendFile(asset.path);
            else res.status(404).send();
        })
        /**
         * Lib paths are used to expose foreign modules to the browser.
         */
        router.get('/lib/:module*',(req,res)=>{
            let modulePath = this.library[req.params.module];
            if (req.params[0]) modulePath += req.params[0];
            if (!modulePath) return res.status(404).send();
            modulePath = path.resolve(modulePath);
            let ext = modulePath.substr(modulePath.lastIndexOf('.') + 1);
            let type = {css:'text/css',js:'text/javascript',html:'text/html'}[ext];
            if (type) res.set("Content-Type",type);
            res.sendFile(modulePath);
        });
        /**
         * Render will deliver a html page built by the requested component
         */
        router.get("/render/:component", async (req,res)=>{
            try {
                let props = jsonic(req.query.props||'{}')
                let page = await this.render(req.params.component,props);
                res.send(page);
            } catch (e) {
                res.status(500).json({status: 'error', message: `${e.message}`});
            }
        });
        return router;
    }
    async render(component,props) {
        let html = this.template.replaceAll('{{comp}}',component);
        html = html.replace('{{props}}',JSON.stringify(props));
        return html;
    }
    get template() {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <link type="text/css" rel="stylesheet" href="/styles/component.css">
    <link type="text/css" rel="stylesheet" href="/styles/static.css">
    <link rel="icon" href="favicon.ico">
    <script src="/lib/moment"></script>
    <script src="/lib/moment-timezone"></script>
    <script type="module" lang="javascript">
        import {{comp}} from '/components/{{comp}}.mjs';
          let comp = new {{comp}}(JSON.parse('{{props}}'));
        setTimeout(async ()=>{
          await comp.render(document.body);
        },100);
    </script>
</head>
<body>
</body>
</html>
`;
    }
}
