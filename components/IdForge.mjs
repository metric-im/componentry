/**
 * Generate a unique alphanumeric id either random or dated to the millisecond.
 */
export default class IdForge {
    static datedId(randomCharacters=8) {
        let id = Number(Date.now()).toString(36);
        id += this.randomId(randomCharacters);
        return id;
    }
    static randomId(length=8) {
        let id = "";
        for (let i=0;i<length;i++) id+=Number(Math.round(Math.random()*25)+10).toString(36);
        return id;
    }
}
