﻿using JIRA_NTB.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

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
        }
    }
}
