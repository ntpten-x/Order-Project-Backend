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
const Ingredients_1 = require("./entity/stock/Ingredients");
const fixImages = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectDatabase)();
        const repo = database_1.AppDataSource.getRepository(Ingredients_1.Ingredients);
        // Update all null img_urls
        // We use a query builder to bulk update
        const result = yield repo.createQueryBuilder()
            .update(Ingredients_1.Ingredients)
            .set({ img_url: "https://placehold.co/600x400?text=Ingredient" })
            .where("img_url IS NULL")
            .execute();
        console.log(`Updated ${result.affected} ingredients with default image.`);
    }
    catch (error) {
        console.error("Error fixing images:", error);
    }
    finally {
        process.exit(0);
    }
});
fixImages();
