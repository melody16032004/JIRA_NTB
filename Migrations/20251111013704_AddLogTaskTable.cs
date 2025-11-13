using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JIRA_NTB.Migrations
{
    /// <inheritdoc />
    public partial class AddLogTaskTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Assignee_Id",
                table: "Tasks",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.CreateTable(
                name: "LogTasks",
                columns: table => new
                {
                    LogId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Progress = table.Column<int>(type: "int", nullable: false),
                    ReassignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OldUserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TaskId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ReassignedById = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogTasks", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_LogTasks_Tasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "Tasks",
                        principalColumn: "IdTask",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LogTasks_Users_OldUserId",
                        column: x => x.OldUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LogTasks_Users_ReassignedById",
                        column: x => x.ReassignedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LogTasks_OldUserId",
                table: "LogTasks",
                column: "OldUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LogTasks_ReassignedById",
                table: "LogTasks",
                column: "ReassignedById");

            migrationBuilder.CreateIndex(
                name: "IX_LogTasks_TaskId",
                table: "LogTasks",
                column: "TaskId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LogTasks");

            migrationBuilder.AlterColumn<string>(
                name: "Assignee_Id",
                table: "Tasks",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);
        }
    }
}
