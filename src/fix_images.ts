import { AppDataSource, connectDatabase } from "./database/database";
import { Ingredients } from "./entity/stock/Ingredients";

const fixImages = async () => {
    try {
        await connectDatabase();
        const repo = AppDataSource.getRepository(Ingredients);

        // Update all null img_urls
        // We use a query builder to bulk update
        const result = await repo.createQueryBuilder()
            .update(Ingredients)
            .set({ img_url: "https://placehold.co/600x400?text=Ingredient" })
            .where("img_url IS NULL")
            .execute();

        console.log(`Updated ${result.affected} ingredients with default image.`);
    } catch (error) {
        console.error("Error fixing images:", error);
    } finally {
        process.exit(0);
    }
};

fixImages();
