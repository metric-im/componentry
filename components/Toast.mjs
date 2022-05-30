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
        window.toast = this;
    }
    display(message,flavor='status') {
        this.window.innerHTML = message;
        this.window.classList.remove('status','warning','error','success');
        this.window.classList.add('active',flavor);
        this.timer = setTimeout(this.close.bind(this),2500);
        this.window.addEventListener('click',this.close.bind(this));
    }
    close() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.window.classList.remove('active');
    }
    status(message) {this.display(message,'status')}
    warning(message,flavor) {this.display(message,'warning')}
    error(message) {this.display(message,'error')}
    success(message) {this.display(message,'success')}
}