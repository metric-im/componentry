import IdForge from './IdForge.mjs';

export default class Component {
    constructor(props) {
        this.props = props;
        this.element = document.createElement('div');
        this.element.id = IdForge.randomId();
        this.element.classList.add(this.constructor.name);
        this.components = [];
        this.watchers={};
        this.lock = new Lock(this);
        this.hub=false;
    }
    new(Comp,props) {
        let component = new Comp(props);
        this.components.push(component);
        component.parent = this;
        return component;
    }
    async render(element) {
        this.element.innerHTML = "";
        let existing = document.querySelector('#'+this.element.id);
        if (element) element.appendChild(this.element);
    }
    async update(props) {
        Object.assign(this.props,props);
        await this.render();
    }
    /**
     * Div is a helper for creating a div with classes and
     * attaching it to a parent
     *
     * @param (optional) classlist a string of space separated classes
     * @param (optional) parent the element to append to, if null then this.element
     * @returns {*}
     */
    div(classlist,parent) {
        let div = document.createElement("div");
        div.id = IdForge.randomId();
        if (classlist) div.classList.add(...classlist.split(' '));
        if (parent) parent.append(div);
        else this.element.append(div);
        return div;
    }
    /**
     * Declare an event listener to execute an action if this component or
     * any children fire the event of the same name.
     *
     * @param event the name of the event to act on. This is an arbitrary string.
     * @param action a function to execute
     */
    on(event,action) {
        let args = Array.from(arguments).splice(2);
        this.watchers[event] = this.watchers[event] || [];
        this.watchers[event].push(action.bind(this,...args));
        for (let w of this.components) {
            w.on(event,action.bind(this,...args));
            // w.watchers[event] = w.watchers[event] || [];
            // w.watchers[event].push(action.bind(this,...args));
        }
    }

    /**
     * Other widgets may call on() to catch events fired by this widget
     * @param event the name of the event to fire. This is an arbitrary string.
     * @param args... fire() may pass any number of arguments to the listeners
     */
    fire(event) {
        let args = Array.from(arguments).splice(1);
        if (this.watchers[event]) {
            for (let w of this.watchers[event]) {
                w(...args);
            }
        }
    }
    show() {
        this.element.style.display = 'block';
    }
    hide() {
        this.element.style.display = 'none';
    }
    async announceUpdate(attributeName) {
        let hubComponent = this;
        while (hubComponent && !hubComponent.hub) {
            if (hubComponent.parent && hubComponent.parent === hubComponent) hubComponent = null;
            hubComponent = hubComponent.parent;
        }
        if (hubComponent) await hubComponent.handleUpdate(attributeName);
    }
    async handleUpdate(attributeName) {
        for (let comp of this.components) {
            if (comp.handleUpdate) await comp.handleUpdate(attributeName);
        }
    }


    /**
     * Data state is maintained by reference. Sometimes local variables need
     * to be added to the results. These are prefaced with double underscore,
     * "__". Scrub recursively removes any attribute that starts with __.
     * @returns {{}}
     */
    scrub(data) {
        return loop(data)
        function loop(data) {
            let o = {};
            for (let key of Object.keys(data)) {
                if (!key.startsWith('__')) {
                    if (Array.isArray(o[key])) o[key] = o[key].map(o=>loop(o));
                    else if (typeof o[key] === 'object') o[key] = loop(o[key]);
                    else  o[key] = data[key];
                }
            }
            return o;
        }
    }

    /**
     * Init attaches the global utilities for popups and toasts.
     * @param element
     * @returns {Promise<void>}
     */
    static async init(element) {
        let Popup = await import('./Popup.mjs');
        let Toast = await import('./Toast.mjs');
        window.popup = new Popup.default();
        await window.popup.render(element);
        window.toast = new Toast.default();
        await window.toast.render(element);
    }
}

/**
 * Locks are used to warn against actions like saving or exiting
 * when a component is in an inappropriate state
 **/
class Lock {
    constructor(comp) {
        this.comp = comp;
        this.locks = {};
    }
    async test(action) {
        if (!this.find(action)) return true
        else return await ({
            save:async ()=>{
                window.toast.warning("Please complete editing before saving");
                return false;
            },
            exit:async()=>{
                return await window.toast.prompt("Continue without saving?");
            }
        })[action]()
    }
    find(action) {
        let components = [];
        if (this.locks.hasOwnProperty(action)) components.push(this.comp);
        for (let comp of this.comp.components) {
            components = components.concat(comp.lock.find(action)||[]);
        }
        if (components.length>0) {
            console.log(this.constructor.name);
        }
        return components.length>0?components:null;
    }
    add(action) {
        this.locks[action] = true;
    }
    remove(action) {
        if (this.locks.hasOwnProperty(action)) delete this.locks[action];
    }
    clear(action) {
        if (action) this.remove(action);
        else this.locks = {};
        for (let comp of this.comp.components) comp.lock.clear(action);
    }
}