/**
 * display a brief message to alert an action
 */

import Component from "./Component.mjs";

export default class Toast extends Component {
    constructor(props) {
        super(props);
    }
    async render(element) {
        await super.render(element);
        this.layout = this.div('layout');
        this.window = this.div('display', this.layout);
        this.message = this.div('message',this.window);
        this.controls = this.div('controls',this.window);
        this.okButton = document.createElement('button');
        this.controls.append(this.okButton)
        this.cancelButton = document.createElement('button');
        this.controls.append(this.cancelButton)
        window.toast = this;
    }
    display(message,flavor='status') {
        this.close();
        this.message.innerHTML = message;
        this.window.classList.remove('status','warning','error','success','prompt');
        this.window.classList.add('active',flavor);
    }
    notify(message,flavor) {
        this.close();
        this.display(message,flavor);
        this.timer = setTimeout(this.close.bind(this), 2500);
        this.window.addEventListener('click', this.clickHandler.bind(this));
    }
    async prompt(message, options) {
        if(!options) options = {};
        let ok_text = options.ok ? options.ok : "ok";
        let cancel_text = options.cancel ? options.cancel : "cancel";

        return new Promise((resolve)=>{
            this.display(message,'prompt');
            this.okButton.innerHTML = ok_text;
            this.okButton.onclick = () => {
                this.close();
                resolve(true);
            };
            this.cancelButton.innerHTML = cancel_text;
            this.cancelButton.onclick = () => {
                this.close();
                resolve(false);
            };
        });
    }
    clickHandler() {
        if(this.window.classList.contains("prompt")) {
            return;
        }
        this.close();
    }
    close() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.window.classList.remove('active');
    }
    status(message) {this.notify(message,'status')}
    warning(message,flavor) {this.notify(message,'warning')}
    error(message) {this.notify(message,'error')}
    success(message) {this.notify(message,'success')}
}