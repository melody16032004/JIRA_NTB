// ===============================
// -----| /js/notification.js |-------
// ===============================

// --- STATE TOÀN CỤC & DOM ELEMENTS ---
let currentMe = null;
const notifyList = document.getElementById("notifyList"); // << UL chứa nội dung cuộn
const notifyButton = document.getElementById("notifyButton");
const notifyBadge = document.getElementById("notifyBadge");
const clearBtn = document.getElementById("clearNotify");
const notifyDropdownContainer = document.getElementById("notifyDropdownContainer"); // << DIV bên ngoài

// SỬA: Đổi pageSize (bạn đã đổi thành 5)
let notifyState = {
    pageIndex: 1,
    pageSize: 5, // Page size (theo yêu cầu)
    totalPages: 1,
    isLoading: false
};

// ================================
// HÀM HELPER (DATA)
// ================================
async function safeFetchJson(url, fallback = []) {
    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn("Fetch failed:", url, err);
        return fallback;
    }
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
}

function mapNotificationData(n) {
    const title = n.title.toLowerCase();
    let icon = "info";
    let color = "text-indigo-400";

    // (Logic map icon của bạn giữ nguyên)
    if (title.includes("quá hạn") || title.includes("overdue") || title.includes("trễ")) {
        icon = "alert-triangle";
        color = "text-red-500";
    }
    else if (title.includes("lỗi") || title.includes("error") || title.includes("thất bại")) {
        icon = "server-crash";
        color = "text-red-600";
    }
    else if (title.includes("bảo mật") || title.includes("security") || title.includes("mật khẩu")) {
        icon = "shield-alert";
        color = "text-red-600";
    }
    else if (title.includes("hoàn thành") || title.includes("done") || title.includes("completed") || title.includes("đã xong")) {
        icon = "check-circle-2";
        color = "text-green-400";
    }
    else if (title.includes("giao task") || title.includes("giao việc") || title.includes("assigned") || title.includes("giao")) {
        icon = "clipboard-list";
        color = "text-blue-400";
    }
    else if (title.includes("nhắc tên") || title.includes("mention") || title.includes("@")) {
        icon = "at-sign";
        color = "text-purple-400";
    }
    else if (title.includes("yêu cầu") || title.includes("request") || title.includes("duyệt")) {
        icon = "clipboard-check";
        color = "text-orange-400";
    }
    else if (title.includes("phòng ban") || title.includes("department")) {
        icon = "building";
        color = "text-cyan-500";
    }
    else if (title.includes("tài khoản") || title.includes("account") || title.includes("người dùng mới")) {
        icon = "user-plus";
        color = "text-pink-400";
    }
    else if (title.includes("thành viên") || title.includes("member") || title.includes("người dùng")) {
        icon = "users";
        color = "text-pink-400";
    }
    else if (title.includes("quyền") || title.includes("permission") || title.includes("vai trò")) {
        icon = "user-cog";
        color = "text-orange-400";
    }
    else if (title.includes("cập nhật") || title.includes("update") || title.includes("thay đổi") || title.includes("edit")) {
        icon = "pencil";
        color = "text-yellow-500";
    }
    else if (title.includes("bình luận") || title.includes("comment")) {
        icon = "message-circle";
        color = "text-gray-300";
    }
    else if (title.includes("tin nhắn") || title.includes("message")) {
        icon = "message-square";
        color = "text-yellow-400";
    }
    else if (title.includes("họp") || title.includes("meeting") || title.includes("lịch")) {
        icon = "calendar-days";
        color = "text-pink-400";
    }
    else if (title.includes("file") || title.includes("tệp") || title.includes("upload")) {
        icon = "paperclip";
        color = "text-cyan-400";
    }
    else if (title.includes("dự án") || title.includes("project")) {
        icon = "folder-git-2";
        color = "text-green-400";
    }
    else if (title.includes("bảo trì") || title.includes("system") || title.includes("hệ thống")) {
        icon = "server-cog";
        color = "text-gray-400";
    }
    return { icon, color };
}


// ================================
// HÀM HELPER (UI)
// ================================
function updateNotifyCount() {
    if (!notifyList || !notifyBadge) return;
    const unread = notifyList.querySelectorAll("li.unread").length;
    notifyBadge.style.display = unread > 0 ? "flex" : "none";
    notifyBadge.textContent = unread > 0 ? unread : "";
}

function triggerShake() {
    if (!notifyButton || !notifyBadge) return;
    if (notifyBadge.style.display !== "none") {
        notifyButton.classList.add("shake");
        setTimeout(() => notifyButton.classList.remove("shake"), 700);
    }
}

function appendNotificationHTML(n, position = 'beforeend') {
    if (!notifyList) return;
    const dot = n.unread
        ? `<span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>`
        : "";

    const unreadClass = n.unread ? "unread" : "";
    const timeColor = n.unread ? "text-gray-400" : "text-gray-500";

    const html = `
        <li class="p-3 hover:bg-gray-700/50 transition flex items-start space-x-3 cursor-pointer ${unreadClass}" data-id="${n.id}">
            <div class="relative">
                <i data-lucide="${n.icon}" class="w-5 h-5 ${n.color} mt-0.5"></i>
                ${dot}
            </div>
            <div>
                <p class="text-sm text-gray-200">${n.message}</p>
                <span class="text-xs ${timeColor}">${n.time}</span>
            </div>
        </li>
    `;

    notifyList.insertAdjacentHTML(position, html);
}

function clearNoNotifyMessage() {
    const noNotify = notifyList.querySelector("li.text-gray-500");
    if (noNotify) noNotify.remove();
}
function addNotificationToList(n) {
    clearNoNotifyMessage();

    appendNotificationHTML(n, 'afterbegin');
    lucide.createIcons();
}


// ================================
// HÀM TẢI DỮ LIỆU (Hỗ trợ phân trang)
// ================================
async function loadNotifications(userId, pageIndex = 1) {
    if (notifyState.isLoading) return;
    notifyState.isLoading = true;

    if (!notifyList) return;

    const loaderId = "notify-loader";
    if (pageIndex === 1) {
        notifyList.innerHTML = `<li id="${loaderId}" class="p-4 text-center text-gray-500 text-xs">Đang tải...</li>`;
    } else if (!document.getElementById(loaderId)) {
        notifyList.insertAdjacentHTML('beforeend', `<li id="${loaderId}" class="p-4 text-center text-gray-500 text-xs">Đang tải thêm...</li>`);
    }

    //console.log(`Đang tải thông báo trang ${pageIndex} cho user: ${userId}`);
    const data = await safeFetchJson(`/api/notification/${userId}?pageIndex=${pageIndex}&pageSize=${notifyState.pageSize}`, { items: [], totalPages: 1 });

    const loaderEl = document.getElementById(loaderId);
    if (loaderEl) loaderEl.remove();

    if (pageIndex === 1) {
        notifyList.innerHTML = "";
    }

    clearNoNotifyMessage();

    notifyState.pageIndex = data.pageIndex || pageIndex; // Cập nhật trang hiện tại
    notifyState.totalPages = data.totalPages || 1; // Cập nhật tổng số trang
    notifyState.isLoading = false;

    if ((!data.items || data.items.length === 0) && pageIndex === 1) {
        notifyList.innerHTML = "<li class='p-4 text-center text-gray-500'>Không có thông báo mới.</li>";
        updateNotifyCount();
        return;
    }

    data.items.forEach(n => {
        const mappedData = mapNotificationData(n);
        const timeAgo = formatTimeAgo(n.createdAt);

        appendNotificationHTML({
            id: n.id,
            ...mappedData,
            message: n.message,
            time: timeAgo,
            unread: !n.isRead
        }, 'beforeend');
    });

    lucide.createIcons();

    updateNotifyCount();
}


// ================================
// ENTRY POINT (KHỞI CHẠY)
// ================================
document.addEventListener("DOMContentLoaded", async () => {

    // 1. LẤY THÔNG TIN NGƯỜI DÙNG
    if (!currentMe) {
        try {
            const meRes = await fetch("/api/user/me", { credentials: 'include' });
            if (meRes.ok) {
                currentMe = await meRes.json();
            }
        } catch (e) {
            console.error("Fetch failed:", e);
        }
    }
    if (!currentMe || currentMe.id == null) {
        window.location.href = "/Error/403";
        return;
    }
    //console.log("Me:", currentMe);


    // 2. KẾT NỐI SIGNALR (CHO NOTIFY MỚI)
    const connection = new signalR.HubConnectionBuilder()
        .withUrl(`/notifyHub?userId=${currentMe.id}`)
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    connection.on("ReceiveNotification", (data) => {
        console.log("Realtime notify:", data);

        const mappedData = mapNotificationData(data);

        addNotificationToList({
            id: data.id,
            ...mappedData,
            message: data.message,
            time: "Vừa xong",
            unread: true
        });

        updateNotifyCount();
        triggerShake();
    });

    connection.start().catch(err => console.error(err.toString()));


    // 3. TẢI DỮ LIỆU CŨ (TRANG 1) TỪ API
    await loadNotifications(currentMe.id, 1);

    // 4. GẮN CÁC EVENT LISTENER CHO POPUP
    if (notifyButton && notifyBadge && notifyList && clearBtn) {

        // Đánh dấu 1 thông báo là đã đọc (Client + Server)
        notifyList.addEventListener("click", async (e) => {
            const li = e.target.closest("li.unread");
            if (!li) return;

            const notificationId = li.dataset.id;
            li.classList.remove("unread");
            const redDot = li.querySelector("span.bg-red-500");
            if (redDot) redDot.remove();
            updateNotifyCount();

            if (notificationId) {
                try {
                    await fetch(`/api/notification/read/${notificationId}`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    console.log(`Đã đánh dấu ${notificationId} là đã đọc.`);
                } catch (err) {
                    console.error("Lỗi khi đánh dấu đã đọc (single):", err);
                }
            }
        });

        // Đánh dấu tất cả là đã đọc (Client + Server)
        clearBtn.addEventListener("click", async () => {
            notifyList.querySelectorAll("li.unread").forEach((li) => {
                li.classList.remove("unread");
                const dot = li.querySelector("span.bg-red-500");
                if (dot) dot.remove();
            });
            updateNotifyCount();

            try {
                await fetch(`/api/notification/read-all/${currentMe.id}`, {
                    method: 'POST',
                    credentials: 'include'
                });
                //console.log("Đã đánh dấu tất cả là đã đọc (server).");
            } catch (err) {
                console.error("Lỗi khi đánh dấu đã đọc:", err);
            }
        });

        // Lặp lại shake (2 giây 1 lần)
        setInterval(() => {
            if (notifyBadge.style.display !== "none") triggerShake();
        }, 2000);

        // ========================================================
        // SỬA: Gắn sự kiện SCROLL cho infinite loading
        // ========================================================
        // SỬA: Gắn vào 'notifyList' (UL), không phải 'notifyDropdownContainer' (DIV)
        if (notifyList) {
            notifyList.addEventListener('scroll', () => {
                // SỬA: Lấy thông số từ 'notifyList'
                const { scrollTop, scrollHeight, clientHeight } = notifyList;

                // Kiểm tra điều kiện (không đang tải, và chưa hết trang)
                if (notifyState.isLoading || notifyState.pageIndex >= notifyState.totalPages) {
                    return;
                }

                // Gần chạm đáy (cách 50px)
                if (scrollTop + clientHeight >= scrollHeight - 50) {
                    //console.log("Đang tải thêm thông báo...");
                    loadNotifications(currentMe.id, notifyState.pageIndex + 1);
                }
            });
        }
    }
});