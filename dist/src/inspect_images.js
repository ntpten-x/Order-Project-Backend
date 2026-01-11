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
const inspectImages = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectDatabase)();
        const repo = database_1.AppDataSource.getRepository(Ingredients_1.Ingredients);
        const ingredients = yield repo.find();
        console.log("Total ingredients:", ingredients.length);
        ingredients.forEach(i => {
            console.log(`ID: ${i.id}, Name: ${i.display_name}`);
            if (i.img_url) {
                console.log(`  img_url length: ${i.img_url.length}`);
                console.log(`  img_url start: ${i.img_url.substring(0, 50)}`);
            }
            else {
                console.log(`  img_url: NULL`);
            }
        });
    }
    catch (error) {
        console.error("Error inspecting images:", error);
    }
    finally {
        process.exit(0);
    }
});
inspectImages();
