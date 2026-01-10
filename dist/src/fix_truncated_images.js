"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const Ingredients_1 = require("./entity/Ingredients");
const fixTruncatedImages = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectDatabase)();
        const repo = database_1.AppDataSource.getRepository(Ingredients_1.Ingredients);
        // Find items with truncated base64 (approx check or exact length 2048)
        // We know the one with 2048 length is bad.
        const badItems = yield repo.createQueryBuilder("ingredients")
            .where("LENGTH(img_url) = 2048")
            .getMany();
        for (const item of badItems) {
            console.log(`Fixing item: ${item.display_name} (ID: ${item.id})`);
            item.img_url = "https://placehold.co/600x400?text=Ingredient";
            // We need to cast because we are fixing the type issue in code via update
            yield repo.save(item);
        }
        console.log(`Fixed ${badItems.length} ingredients.`);
    }
    catch (error) {
        console.error("Error fixing images:", error);
    }
    finally {
        process.exit(0);
    }
});
fixTruncatedImages();
