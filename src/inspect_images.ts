import { AppDataSource, connectDatabase } from "./database/database";
import { Ingredients } from "./entity/Ingredients";

const inspectImages = async () => {
    try {
        await connectDatabase();
        const repo = AppDataSource.getRepository(Ingredients);
        const ingredients = await repo.find();

        console.log("Total ingredients:", ingredients.length);
        ingredients.forEach(i => {
            console.log(`ID: ${i.id}, Name: ${i.display_name}`);
            if (i.img_url) {
                console.log(`  img_url length: ${i.img_url.length}`);
                console.log(`  img_url start: ${i.img_url.substring(0, 50)}`);
            } else {
                console.log(`  img_url: NULL`);
            }
        });

    } catch (error) {
        console.error("Error inspecting images:", error);
    } finally {
        process.exit(0);
    }
};

inspectImages();
