using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JIRA_NTB.Migrations
{
    /// <inheritdoc />
    public partial class CreateLogStatusUpdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LogStatusUpdates",
                columns: table => new
                {
                    LogId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdTask = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdUserUpdate = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    updateAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PreviousStatusId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewStatusId = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogStatusUpdates", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_LogStatusUpdates_Tasks_IdTask",
                        column: x => x.IdTask,
                        principalTable: "Tasks",
                        principalColumn: "IdTask",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LogStatusUpdates_Users_IdUserUpdate",
                        column: x => x.IdUserUpdate,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LogStatusUpdates_IdTask",
                table: "LogStatusUpdates",
                column: "IdTask");

            migrationBuilder.CreateIndex(
                name: "IX_LogStatusUpdates_IdUserUpdate",
                table: "LogStatusUpdates",
                column: "IdUserUpdate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LogStatusUpdates");
        }
    }
}
