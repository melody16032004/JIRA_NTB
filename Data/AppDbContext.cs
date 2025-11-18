using JIRA_NTB.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Emit;

namespace JIRA_NTB.Data
{
    public class AppDbContext : IdentityDbContext<UserModel, ApplicationRole, string>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }
        public DbSet<DepartmentModel> Departments { get; set; }
        public DbSet<ProjectModel> Projects { get; set; }
        public DbSet<TaskItemModel> Tasks { get; set; }
        public DbSet<Status> Statuses { get; set; }
        public DbSet<ProjectManagerModel> ProjectManagers { get; set; }
        public DbSet<LogTaskModel> LogTasks { get; set; }
        public DbSet<LogStatusUpdate> LogStatusUpdates { get; set; }
        public DbSet<LogDevice> logDevices { get; set; }
        public DbSet<CheckIn> checkIns { get; set; }
        public DbSet<NotificationsModel> Notifications { get; set; }
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Đổi tên bảng mặc định của Identity cho gọn
            builder.Entity<UserModel>().ToTable("Users");
            builder.Entity<ApplicationRole>().ToTable("Roles");
            builder.Entity<IdentityUserRole<string>>().ToTable("UserRoles");
            builder.Entity<IdentityUserClaim<string>>().ToTable("UserClaims");
            builder.Entity<IdentityUserLogin<string>>().ToTable("UserLogins");
            builder.Entity<IdentityRoleClaim<string>>().ToTable("RoleClaims");
            builder.Entity<IdentityUserToken<string>>().ToTable("UserTokens");

            // Thiết lập khóa chính cho bảng trung gian ProjectManager
            builder.Entity<ProjectManagerModel>()
                .HasKey(pm => new { pm.UserId, pm.ProjectId });


            // Thiết lập quan hệ 1-nhiều giữa Department và User
            builder.Entity<UserModel>()
                .HasOne(u => u.Department)
                .WithMany(d => d.Users)
                .HasForeignKey(u => u.IdDepartment)
                .OnDelete(DeleteBehavior.SetNull);

            // Task - Assignee
            builder.Entity<TaskItemModel>()
                .HasOne(t => t.Assignee)
                .WithMany(u => u.Tasks)
                .HasForeignKey(t => t.Assignee_Id)
                .OnDelete(DeleteBehavior.Restrict);

            // Task - Project
            builder.Entity<TaskItemModel>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Tasks)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            // Project - Manager
            builder.Entity<ProjectModel>()
                .HasOne(p => p.Manager)
                .WithMany(u => u.ManagedProjects)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Status - Project & Task
            builder.Entity<ProjectModel>()
                .HasOne(p => p.Status)
                .WithMany(s => s.Projects)
                .HasForeignKey(p => p.StatusId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<TaskItemModel>()
                .HasOne(t => t.Status)
                .WithMany(s => s.Tasks)
                .HasForeignKey(t => t.StatusId)
                .OnDelete(DeleteBehavior.Restrict);
            // ===============================
            // 🔹 Task - LogTask (1-nhiều)
            // ===============================
            builder.Entity<TaskItemModel>()
                .HasMany(t => t.Logs)
                .WithOne(l => l.Task)
                .HasForeignKey(l => l.TaskId)
                .OnDelete(DeleteBehavior.Cascade);

            // ===============================
            // 🔹 LogTask - OldUser (1-nhiều)
            // ===============================
            builder.Entity<LogTaskModel>()
                .HasOne(l => l.OldUser)
                .WithMany() // Không cần navigation ngược
                .HasForeignKey(l => l.OldUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // ===============================
            // 🔹 LogTask - ReassignedBy (1-nhiều)
            // ===============================
            builder.Entity<LogTaskModel>()
                .HasOne(l => l.ReassignedBy)
                .WithMany() // Không cần navigation ngược
                .HasForeignKey(l => l.ReassignedById)
                .OnDelete(DeleteBehavior.Restrict);
            builder.Entity<LogDevice>(entity =>
            {
                entity.ToTable("LogDevices"); // tên bảng trong SQL
                entity.HasKey(ld => ld.IdLog);
                entity.Property(ld => ld.AppName).HasMaxLength(100);
                entity.Property(ld => ld.DeviceId).HasMaxLength(200);
            });
            builder.Entity<CheckIn>()
            .HasOne(c => c.User)
            .WithMany(u => u.CheckIns)
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade); // Khi xóa user thì xóa luôn check-in của họ
            // ===============================
            // Task - LogStatusUpdate (1-nhiều)
            // ===============================
            builder.Entity<TaskItemModel>()
                .HasMany(t => t.LogStatusUpdates)
                .WithOne(l => l.Task)
                .HasForeignKey(l => l.IdTask)
                .OnDelete(DeleteBehavior.Cascade);
            // ===============================
            // LogStatusUpdate - User (1-nhiều)
            // ===============================
            builder.Entity<LogStatusUpdate>()
                .HasOne(l => l.User)
                .WithMany()
                .HasForeignKey(l => l.IdUserUpdate)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
