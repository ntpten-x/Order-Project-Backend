"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.UsersService = void 0;
const bcrypt = __importStar(require("bcrypt"));
const socket_service_1 = require("./socket.service");
const realtimeEvents_1 = require("../utils/realtimeEvents");
class UsersService {
    constructor(usersModel) {
        this.usersModel = usersModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.usersModel.findAll(filters);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.usersModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(users) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const findUser = yield this.usersModel.findOneByUsername(users.username);
                if (findUser) {
                    throw new Error("มีชื่อผู้ใช้ " + users.username + " อยู่ในระบบแล้ว");
                }
                users.password = yield bcrypt.hash(users.password, 10);
                yield this.usersModel.create(users);
                const createdUser = yield this.usersModel.findOneByUsername(users.username);
                this.socketService.emitToRole('Admin', realtimeEvents_1.RealtimeEvents.users.create, createdUser);
                return createdUser;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, users) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const findUser = yield this.usersModel.findOne(id);
                if (!findUser) {
                    throw new Error("ไม่พบผู้ใช้");
                }
                if (users.password) {
                    users.password = yield bcrypt.hash(users.password, 10);
                }
                if (users.username && findUser.username !== users.username) {
                    const findUserByUsername = yield this.usersModel.findOneByUsername(users.username);
                    if (findUserByUsername) {
                        throw new Error("มีชื่อผู้ใช้ " + users.username + " อยู่ในระบบแล้ว");
                    }
                }
                yield this.usersModel.update(id, users);
                const updatedUser = yield this.usersModel.findOne(id);
                this.socketService.emitToRole('Admin', realtimeEvents_1.RealtimeEvents.users.update, updatedUser);
                return updatedUser;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.usersModel.delete(id);
                this.socketService.emitToRole('Admin', realtimeEvents_1.RealtimeEvents.users.delete, { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.UsersService = UsersService;
