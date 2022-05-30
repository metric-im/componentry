import fs from "fs";
import express from "express";
import Connector from './Connector.mjs';
import path from "path";
import {fileURLToPath} from "url";

export default class Componentry {
    constructor(app,profile,options) {
        this.profile = profile;
        this.options = options||{};
        this.modules = {};
        this.components = {};
        this.library = {}
        this.app = app;
        this.rootPath = path.dirname(fileURLToPath(import.meta.url));
    }
    /**
     * Load modules and their components.
     * @returns {Promise<void>}
     */
    async init() {
        this.connector = await Connector.mint(this.profile);
        this.connector.modules = this.modules;
        // load root components
        this.loadComponents(this.rootPath+'/components');
        // From arguments load modules, their components, routes and library
        for (let module of Array.from(arguments)) {
            let instance = module.mint?(await module.mint(this.connector)):(new module(this.connector));
            this.modules[module.name] = {module:instance,path:path.dirname(fileURLToPath(import.meta.url))};
            this.loadComponents(instance.componentPath);
            if (instance.routes) this.loadRoutes(instance.routes());
            if (instance.library) this.loadLibrary(instance.library);
        }
        this.loadRoutes(this.routes());
        this.loadComponents(this.app.__dirname+"/components");
    }
    loadComponents(path) {
        try {
            let components = fs.readdirSync(path);
            for (let comp of components) this.components[comp] = path+"/"+comp;
        } catch(e) {}
    }
    loadLibrary(library) {
        Object.assign(this.library,library)
    }
    loadRoutes(routes) {
        this.app.use(routes);
    }
    routes() {
        let router = express.Router();
        router.use('/components/:component',(req,res)=>{
            let level = req.account?req.account.level||0:0;
            res.set("Content-Type","text/javascript");
            let js = fs.readFileSync(this.components[req.params.component]).toString();
            js = js.replace(/\/\*ACL([<>]{1})(\d){1}\*\/(.*?)\/\*ENDACL\*\//gs,(match,op,acl,code)=>{
                acl = parseInt(acl);
                if (op==='>'?level>acl:level<acl) return code;
                else return "";
            });
            res.send(js);
        });
        router.use('/styles/component.css',(req,res)=>{
            let sheets = Object.keys(this.components).filter(fn => fn.endsWith('.css'));
            let css = sheets.reduce((r,name)=>{
                let sheet = fs.readFileSync(this.components[name]).toString();
                sheet = sheet.replace(/(^[A-Za-z>.#@*:].*){/mg,(base)=>{
                    base = base.split(',');
                    return base.map(b=>"."+name.slice(0,-4)+" "+b.replace(/^\.([\W]*{)/,"$1"))
                })
                return r+sheet+"\n";
            },"");
            res.set("Content-Type","text/css");
            res.send(css);
        });
        router.get('/lib/:module/:path?',(req,res)=>{
            let path = this.library[req.params.module];
            if (req.params.path) path += req.params.path;
            if (!path) return res.status(404).send();
            res.set("Content-Type","text/javascript");
            res.sendFile(path);
        });
        return router;
    }
}