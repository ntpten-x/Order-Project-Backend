import { AppDataSource, connectDatabase } from "./database/database";
import { Ingredients } from "./entity/Ingredients";

const fixTruncatedImages = async () => {
    try {
        await connectDatabase();
        const repo = AppDataSource.getRepository(Ingredients);

        // Find items with truncated base64 (approx check or exact length 2048)
        // We know the one with 2048 length is bad.
        const badItems = await repo.createQueryBuilder("ingredients")
            .where("LENGTH(img_url) = 2048")
            .getMany();

        for (const item of badItems) {
            console.log(`Fixing item: ${item.display_name} (ID: ${item.id})`);
            item.img_url = "https://placehold.co/600x400?text=Ingredient";
            // We need to cast because we are fixing the type issue in code via update
            await repo.save(item);
        }

        console.log(`Fixed ${badItems.length} ingredients.`);
    } catch (error) {
        console.error("Error fixing images:", error);
    } finally {
        process.exit(0);
    }
};

fixTruncatedImages();
