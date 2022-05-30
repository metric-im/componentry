import Component from './Component.mjs';

export default class Popup extends Component {
    constructor(props) {
        super(props);
    }
    async render(element) {
        await super.render(element);
        this.shim = this.div('shim',this.element);
        this.window = this.div('window',this.element);
        this.header = this.div('header',this.window);
        this.headerTitle = this.div('header-title',this.header);
        this.headerClose = this.div('header-close',this.header);
        this.headerClose.innerHTML=`<span class='icon icon-cross'>`;
        this.content = this.div('content',this.window);
        this.control = this.div('control',this.window);
        this.headerClose.addEventListener('click',()=>{this.close();});
        window.popup = this;
    }
    async display(title='',element,buttons=[]) {
        this.content.innerHTML="";
        this.headerTitle.innerHTML = title;
        this.element.style.zIndex="1000";
        this.element.style.opacity="100%";
        this.content.append(element);
        this.control.innerHTML="";
        for (let btn of buttons) await btn.render(this.control);

    }
    close() {
        this.element.style.zIndex="-1000";
        this.element.style.opacity="0";
    }
}