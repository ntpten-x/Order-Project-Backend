"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const socket_service_1 = require("../../services/socket.service");
const realtimeEvents_1 = require("../../utils/realtimeEvents");
function buildIoMock() {
    const roomEmit = vitest_1.vi.fn();
    const io = {
        emit: vitest_1.vi.fn(),
        to: vitest_1.vi.fn(() => ({ emit: roomEmit })),
    };
    return { io, roomEmit };
}
(0, vitest_1.describe)("SocketService contract", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("emits allowlisted global event to all clients", () => {
        const { io } = buildIoMock();
        const svc = socket_service_1.SocketService.getInstance();
        svc.io = io;
        svc.emit(realtimeEvents_1.RealtimeEvents.system.announcement, { message: "maintenance" });
        (0, vitest_1.expect)(io.emit).toHaveBeenCalledWith(realtimeEvents_1.RealtimeEvents.system.announcement, { message: "maintenance" });
    });
    (0, vitest_1.it)("routes admin-prefixed events to Admin room", () => {
        const { io, roomEmit } = buildIoMock();
        const svc = socket_service_1.SocketService.getInstance();
        svc.io = io;
        svc.emit(realtimeEvents_1.RealtimeEvents.users.update, { id: "u1" });
        (0, vitest_1.expect)(io.to).toHaveBeenCalledWith("role:Admin");
        (0, vitest_1.expect)(roomEmit).toHaveBeenCalledWith(realtimeEvents_1.RealtimeEvents.users.update, { id: "u1" });
    });
    (0, vitest_1.it)("emits branch-scoped events to branch room", () => {
        const { io, roomEmit } = buildIoMock();
        const svc = socket_service_1.SocketService.getInstance();
        svc.io = io;
        svc.emitToBranch("b-123", realtimeEvents_1.RealtimeEvents.orders.update, { id: "o1" });
        (0, vitest_1.expect)(io.to).toHaveBeenCalledWith("branch:b-123");
        (0, vitest_1.expect)(roomEmit).toHaveBeenCalledWith(realtimeEvents_1.RealtimeEvents.orders.update, { id: "o1" });
    });
    (0, vitest_1.it)("fans out event to multiple user rooms for multi-client delivery", () => {
        const { io, roomEmit } = buildIoMock();
        const svc = socket_service_1.SocketService.getInstance();
        svc.io = io;
        svc.emitToUsers(["u-1", "u-2"], realtimeEvents_1.RealtimeEvents.orders.update, { id: "o2" });
        (0, vitest_1.expect)(io.to).toHaveBeenNthCalledWith(1, "u-1");
        (0, vitest_1.expect)(io.to).toHaveBeenNthCalledWith(2, "u-2");
        (0, vitest_1.expect)(roomEmit).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(roomEmit).toHaveBeenCalledWith(realtimeEvents_1.RealtimeEvents.orders.update, { id: "o2" });
    });
});
