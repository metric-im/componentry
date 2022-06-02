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
        this.window = this.div('display');
        this.message = this.div(null,this.window);
        this.controls = this.div('controls',this.window);
        this.okButton = document.createElement('button');
        this.okButton.innerHTML = "ok";
        this.controls.append(this.okButton)
        this.cancelButton = document.createElement('button');
        this.cancelButton.innerHTML = "cancel";
        this.controls.append(this.cancelButton)
        window.toast = this;
    }
    display(message,flavor='status') {
        this.message.innerHTML = message;
        this.window.classList.remove('status','warning','error','success','prompt');
        this.window.classList.add('active',flavor);
    }
    notify(message,flavor) {
        this.display(message,flavor);
        this.timer = setTimeout(this.close.bind(this),2500);
        this.window.addEventListener('click',this.close.bind(this));
    }
    async prompt(message) {
        return new Promise((resolve)=>{
            this.display(message,'prompt');
            this.okButton.onclick = ()=>{
                this.close();
                resolve(true);
            };
            this.cancelButton.onclick = ()=>{
                this.close();
                resolve(false);
            };
        });
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