import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocketService } from "../../services/socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";

type MockIo = {
    emit: any;
    to: any;
};

function buildIoMock() {
    const roomEmit = vi.fn();
    const io: MockIo = {
        emit: vi.fn(),
        to: vi.fn(() => ({ emit: roomEmit })),
    };

    return { io, roomEmit };
}

describe("SocketService contract", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("emits allowlisted global event to all clients", () => {
        const { io } = buildIoMock();
        const svc = SocketService.getInstance() as unknown as { io: MockIo | null; emit: (event: string, data: unknown) => void };
        svc.io = io;

        svc.emit(RealtimeEvents.system.announcement, { message: "maintenance" });

        expect(io.emit).toHaveBeenCalledWith(RealtimeEvents.system.announcement, { message: "maintenance" });
    });

    it("routes admin-prefixed events to Admin room", () => {
        const { io, roomEmit } = buildIoMock();
        const svc = SocketService.getInstance() as unknown as { io: MockIo | null; emit: (event: string, data: unknown) => void };
        svc.io = io;

        svc.emit(RealtimeEvents.users.update, { id: "u1" });

        expect(io.to).toHaveBeenCalledWith("role:Admin");
        expect(roomEmit).toHaveBeenCalledWith(RealtimeEvents.users.update, { id: "u1" });
    });

    it("emits branch-scoped events to branch room", () => {
        const { io, roomEmit } = buildIoMock();
        const svc = SocketService.getInstance() as unknown as { io: MockIo | null; emitToBranch: (branchId: string, event: string, data: unknown) => void };
        svc.io = io;

        svc.emitToBranch("b-123", RealtimeEvents.orders.update, { id: "o1" });

        expect(io.to).toHaveBeenCalledWith("branch:b-123");
        expect(roomEmit).toHaveBeenCalledWith(RealtimeEvents.orders.update, { id: "o1" });
    });

    it("fans out event to multiple user rooms for multi-client delivery", () => {
        const { io, roomEmit } = buildIoMock();
        const svc = SocketService.getInstance() as unknown as {
            io: MockIo | null;
            emitToUsers: (userIds: string[], event: string, data: unknown) => void;
        };
        svc.io = io;

        svc.emitToUsers(["u-1", "u-2"], RealtimeEvents.orders.update, { id: "o2" });

        expect(io.to).toHaveBeenNthCalledWith(1, "u-1");
        expect(io.to).toHaveBeenNthCalledWith(2, "u-2");
        expect(roomEmit).toHaveBeenCalledTimes(2);
        expect(roomEmit).toHaveBeenCalledWith(RealtimeEvents.orders.update, { id: "o2" });
    });
});
