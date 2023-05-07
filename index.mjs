import fs from "fs";
import express from "express";
import Connector from './Connector.mjs';
import path from "path";
import {fileURLToPath} from "url";
import jsonic from "jsonic"

class Module {
    constructor(connector,metaUrl) {
        this.connector = connector
        if (metaUrl) {
            this.rootPath = path.dirname(fileURLToPath(metaUrl));
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
     * Each module can inject styles into the common page harness
     * @returns {string[]}
     */
    get styles() {
        return [];
    }

    /**
     * Provide full qualified paths to the library files
     * @returns {string[]}
     */
    get absoluteLibrary() {
        if (!this.rootPath) return {};
        let path = this.rootPath.replace(/\/node_modules\/.*/,"")
        return Object.entries(this.library).reduce((result,[key,value])=>{
            result[key] = path+"/node_modules"+value;
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
        this.styles = ['/styles/component.css'];
    }

    /**
     * Modules loaded by componentry should extend Componentry.Module;
     * @type {*}
     */
    static Module = Module;
    /**
     * Load modules and their components.
     * @returns {Promise<void>}
     */
    async init() {
        this.connector = await Connector.mint(this);
        // From arguments load modules, their components, routes and library
        let modules = Array.from(arguments);
        modules.unshift(ComponentryModule);
        let styles = [];
        for (let module of modules) {
            let instance = module.mint?(await module.mint(this.connector)):(new module(this.connector));
            this.modules[module.name] = instance;
            if (instance.styles && instance.styles.length > 0) {
                for (let s of instance.styles) if (!this.styles.includes(s)) this.styles.push(s);
            }
            if (instance.components) Object.assign(this.components,instance.components);
            if (instance.routes) this.app.use(instance.routes());
            if (instance.library) Object.assign(this.library,instance.absoluteLibrary);
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
                })
                // sheet = sheet.replace(/(^@media.*?)({(\n|.)*?\n})/mg,(all,media,block)=>{
                //     block = block.replace(//)
                //     return "hello "+media + block;
                // })
                return r+sheet+"\n";
            },"");
            res.set("Content-Type","text/css");
            res.send(css);
        });
        /**
         * Lib paths are used to expose foreign modules to the browser.
         */
        router.get('/lib/:module/:path?',(req,res)=>{
            let modulePath = this.library[req.params.module];
            if (req.params.path) modulePath += req.params.path;
            if (!modulePath) return res.status(404).send();
            modulePath = path.resolve(modulePath);
            res.set("Content-Type","text/javascript");
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
        html = html.replace('{{styles}}',this.styles.reduce((r,s)=>{
            r = r + `<link type="text/css" rel="stylesheet" href="${s}">`
            return r;
        },""));
        return html;
    }
    get template() {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    {{styles}}
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
