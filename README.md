# Componentry
Componentry is a lightweight component harness that allows packages
to mix routing paths and client components into the host

## Usage
```js
import Componentry from 'Componentry'
let componentry = new Componentry()
await HotMods.init(PackageA,PackageB,...); 
```
### constructor([connector][,options])
Connector can be used to pass context and data such as a database handle through to
all modules. Options are:

* **acl** - integer, in the source code `/*ACL>X*/ ... /*ENDACL*/` can block of code that will be redacted if given ACL is less than X.

### init([modules...]) 
Provide one or more modules as arguments. Modules can be referenced either as
npm module names or relative paths from the root of the host project.

### routes()
Returns express middleware that adds two paths

* */components/:componentName* - The referenced component is returned as javascript after parsing ACL blocks options.acl is set
* */styles/component.css* - Returns a composite of all the .css files that match .mjs files in the modules components directory

### attach(app)
Runs through each loaded module looking for a routes() method. If routes are defined
the return value is attached as middleware to the given app.

## Module Structure
A module loaded by Componentry must have an index.mjs file at the root. It may define routes()
which is expected to return express middleware.

If the module includes a `components` folder, all components are loaded and made available
with `/components/:componentName`. Component name should include the .mjs extension. Note
that modules are loaded in order. If there are components of the same name, the one loaded
last overwrites earlier references. After loading all named modules, the components folder
of the host project is loaded, if it exists.

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

