/**
 * Connect to the database and account, if authorization is provided
 */
import IdForge from './components/IdForge.mjs';
import mongodb from 'mongodb';
export default class Connector {
    constructor(componentry) {
        this.componentry = componentry
        this.profile = componentry.profile;
        this.idForge = IdForge;
    }

    /**
     * Mint is an async implementation for new Connector
     * @param profile PROD, DEV or STAGING
     * @returns Connector
     */
    static async mint(componentry) {
        let connector = new Connector(componentry);
        if (connector.profile.init) await connector.profile.init();
        if (componentry.db) {
            connector.db = componentry.db
        } else if (connector.profile.mongo) {
            connector.MongoClient = mongodb.MongoClient;
            let mongo = await connector.MongoClient.connect(
                connector.profile.mongo.host,
                {useNewUrlParser:true,useUnifiedTopology:true}
            );
            connector.db = mongo.db();
        }
        return connector;
    }
    get acl() {
        let that = this;
        return {
            async remove(entity,resource) {
                return await this.db.collection('acl').deleteOne(Object.assign({},entity,resource));
            },
            assign:{
                async all(entity,resource) {return await assign.call(that,...arguments)},
                async read(entity,resource) {return await assign.call(that,...arguments,{level:1})},
                async write(entity,resource) {return await assign.call(that,...arguments,{level:2})},
                async owner(entity,resource) {return await assign.call(that,...arguments,{level:3})}
            },
            test:{
                async all(entity,resource) {return await test.call(that,...arguments)},
                async read(entity,resource) {return await test.call(that,...arguments) >= 1},
                async write(entity,resource) {return await test.call(that,...arguments) >= 2},
                async owner(entity,resource) {return await test.call(that,...arguments) >= 3}
            },
            get:{
                async all(entity,resource) {return await get.call(that,...arguments,{level:{$gte:0}})},
                async read(entity,resource) {return await get.call(that,...arguments,{level:{$gte:1}})},
                async write(entity,resource) {return await get.call(that,...arguments,{level:{$gte:2}})},
                async owner(entity,resource) {return await get.call(that,...arguments,{level:{$gte:3}})}
            }
        }
        async function assign(entity,resource,options) {
            let date = new Date();
            if (!Array.isArray(resource)) resource = [Object.assign({},resource,options)];
            let writes = [];
            for (let o of resource) {
                let id = Object.assign({},entity,Object.keys(o).reduce((r,key)=>{
                    if (key!=='level') r[key] = o[key];
                    return r;
                },{}));
                if (o.level >= 0) writes.push({updateOne:{
                    filter:{_id:id},
                    update:{$set:Object.assign({_modified:date},{level:o.level||0}), $setOnInsert:{_created:date}},
                    upsert:true}});
                else writes.push({deleteOne:{
                    filter:{_id:id},
                }})
            }
            return await this.db.collection('acl').bulkWrite(writes);
        }
        async function test(entity,resource) {
            let result = await this.db.collection('acl').findOne({
                ["_id."+Object.keys(entity)[0]]:Object.values(entity)[0],
                ["_id."+Object.keys(resource)[0]]:Object.values(resource)[0]
            })
            return result?result.level:-1;
        }
        async function get(entity,resource,options) {
            let query = {["_id."+Object.keys(entity)[0]]:Object.values(entity)[0]};
            if (resource) {
                if (typeof resource === "string") query["_id."+resource]={$exists:1}
                else if (!Object.values(resource)[0]) query["_id."+Object.keys(resource)[0]]={$exists:1}
                else query["_id."+Object.keys(resource)[0]]=Object.values(resource)[0];
            }
            if (options) Object.assign(query,options);
            return await this.db.collection('acl').find(query).sort({"_id.resource":1}).toArray();
        }
    }
}
