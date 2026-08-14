import { YankiConnect } from "yanki-connect";
const anki = new YankiConnect();
async function main() {
    try {
        const fields = await anki.model.modelFieldNames({ modelName: "TOCFL" });
        console.log(JSON.stringify(fields, null, 2));
    } catch (error) {
        console.error(error);
    }
}
main();
