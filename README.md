# Componentry
Componentry is a lightweight component harness built for expressjs that enables packages
to mix routing paths, resources and client components into the host

See also `metric-im/common-mixin`. Common mixin is a Componentry module that provides many common widgets
such as tables and input fields.

## Usage
```js
import express from 'express';
import Componentry from '@metric-im/Componentry'
import Profile from './profile.mjs' // shared resources such as a database connection
import PackageA from 'PackageA'; // module imported through npm
import PackageB from './modules/PackageA/index.mjs'; // module imported through relative path

let app = express();
let componentry = new Componentry(app,await Profile());
await componentry.init(PackageA,PackageB,...); 
```
### constructor(app,profile)

* **app** is the instance of express. Componentry will add routes with `app.use()`
* **profile** is an arbitrary object of state data that is available to each component as `this.connector.profile`.

Profile can be used to initialize context and data such as a database handle through to
all modules. Options are:

### componentry.init([modules...]) 
Provide one or more modules as arguments. Modules can be referenced either as
npm module names or relative paths from the root of the host project. The construction of a module is discussed below.

The order of modules determines the resolution of name conflicts. Modules named later may override routes and components of modules named before. The application that invokes componentry.init may have components (in ./components) and routes of it's own. These take precedence of any elements of modules imported through init.

### routes
The express instance provide through **app** will export endpoints the client can use to access the integrated resources of each modules

* **/components/:componentName** - The referenced component is returned as javascript after parsing ACL blocks options.acl is set
* **/styles/component.css** - Returns a composite of all the .css files that match .mjs files in the modules components directory
* **/lib/:node_module/:path** - Returns a declared module from node_modules, optionally with a path to a specific resource in that module.

## Module Structure
A module is an imported class that declares any routes the module would like to add to the express app.
It may also reference packages in node_modules which it would like to be made available to its client components through `/lib/{module_name}`

A module that only provides routes could be a single file, such as MyModule.mjs.
Most modules, however, are packaged in a folder with a subdirectory for client components.

### module.Routes()

If the module declares a method named routes() this is expected to return a router that will be merged into the
app. For example:

```
routes() {
    const router = express.Router();
    router.get('/moduleName/hello',(req,res,next) => {
        res.send('hello');
    })
    return router();
}
```

### module.library

Most npm modules are designed to be used either by the client browser or the nodejs host.
For convenience, a Componentry module make declare npm modules it would like to be available to the client.

The library attribute should return an object where each attribute is a path to the npm module. For example

```
get library() {
    return {
        'moment':'/moment/min/moment-with-locales.min.js'
    };
}
```
By adding to the library, the module's components may then import these npm packages.
```
import moment from '/lib/moment';
```

### Components Folder

If the module includes a `components` folder, all components are loaded and made available
to the client with `/components/:componentName`. Component name should include the .mjs extension. Note
that modules are loaded in order. If there are components of the same name, the one loaded
last overwrites earlier references. After loading all named modules, the components folder
of the host project is loaded, if it exists.

Componentry includes a few of its own components. **Component.mjs**, is a super class that
compoments should extend. It provides a number of common features useful to each component.

>NOTE: **IdForge.mjs** is an internal class, but may be useful for generating random id's

All components must at least implement a method named `render()` which expends to be given
a DOM element on which to attach its features.

```
import Component from './Component.mjs'
export default class MyComponent extends Component {
    constructor(props) {
        super(props);
    }
    async render(element) {
        await super.render(element);
        this.element.innerHTML = "hello";
    }
}
```

Invoking the static method Component.init() when the app loads will add two helpers to the
window object, `window.toast` and `window.popup`

#### Toast
Toast is used to send a brief notification message to the screen. It can also be used to prompt the
user with an "ok" or "cancel" message.

```js
window.toast.[staust|warning|error|success](string message)
window.prompt(string message)`
```

#### Popup
Popup provides a modal display that covers the screen. It expects a title, a DOM element and an optional
array of buttons. Buttons are expected to e components themselves which are rendered in the popup.

```js
let elem = document.createElement('DIV');
elem.innerHTML = "hello";
window.popup("say hello",elem);
```

### Common Styling

In the components folder, each component mjs file can have a corresponding css file. The
CSS is merged into a single components.css file. To avoid clashes, each css tag is prepended
with a class name matching the component name.

For example:
```css
. {
    color:blue;
}
TABLE {
    margin:3px;
}
```
becomes
```css
.CompName {
    color:blue;
}
.CompName TABLE {
    margin:3px;
}
```

### Feature Redaction Based on ACL
If the app attaches an `account` object to the request object, it can be used to filter component code delivered to the client
demarked with `/*ACL>X*/ ... /*ENDACL*/`. Any code within the ACL block will be redacted if given account.level is less than X.

For example, a request to the app for `/compoment/SomewhatSensitive.mjs` could contain elements only meant for certain users.
The app is expected to have added an account object to the request which declares a `level` attribute, such as req.account.level=2.

```
async render(element) {
    await super.render(element);
    this.element.innerHTML = "<p>Hello</p>";
    /*ACL>1*/ this.element.innerHTML += "<p>you are important</p>" /*ENDACL*/
}
```


