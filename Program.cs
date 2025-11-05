using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ✅ Cấu hình Identity
builder.Services.AddIdentity<UserModel, ApplicationRole>()
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders()
.AddTokenProvider<EmailConfirmationTokenProvider<UserModel>>("EmailConfirmationTokenProvider");

builder.Services.Configure<IdentityOptions>(options =>
{
	// User settings
	options.User.AllowedUserNameCharacters =
	"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";
	options.User.RequireUniqueEmail = true;

	//Password settings
	options.Password.RequireDigit = true;
	options.Password.RequireLowercase = true;
	options.Password.RequireUppercase = true;
	options.Password.RequireNonAlphanumeric = false;
	options.Password.RequiredLength = 8;

	// Sign-in settings - Yêu cầu xác nhận email
	options.SignIn.RequireConfirmedEmail = true;

	// Token settings - Sử dụng custom token provider cho email confirmation
	options.Tokens.EmailConfirmationTokenProvider = "EmailConfirmationTokenProvider";
});

builder.Services.ConfigureApplicationCookie(options =>
{
	// Cài đặt thời gian cookie hết hạn
	options.ExpireTimeSpan = TimeSpan.FromMinutes(60);

	// Nếu true, mỗi khi người dùng truy cập trang (sau 1/2 thời gian),
	// cookie sẽ được làm mới lại đủ 60 phút.
	// Nếu người dùng "im lặng" quá 60 phút, họ sẽ bị logout.
	options.SlidingExpiration = true;

	// ... các cài đặt khác như LoginPath
	options.LoginPath = "/Account/Login";
});

builder.Services.AddTransient<IEmailSender, EmailSenderService>();

// Đăng ký background service để tự động xóa tài khoản chưa xác nhận
builder.Services.AddHostedService<UnconfirmedAccountCleanupService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}
using (var scope = app.Services.CreateScope())
{
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<UserModel>>();

    string email = "Vu@example.com";
    string password = "Test@123";

    var existingUser = await userManager.FindByEmailAsync(email);
    if (existingUser == null)
    {
        var user = new UserModel
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(user, password);

        if (result.Succeeded)
        {
            Console.WriteLine($"✅ User test đã tạo thành công. ID: {user.Id}");
        }
        else
        {
            Console.WriteLine("❌ Lỗi tạo user test:");
            foreach (var error in result.Errors)
                Console.WriteLine($" - {error.Description}");
        }
    }
    else
    {
        Console.WriteLine($"⚠️ User test đã tồn tại. ID: {existingUser.Id}");
    }
}


app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
	name: "areas",
	pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();
