import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

function getCppPath(headerPath: string): string {
  const parts = headerPath.split(path.sep);
  const includeIndex = parts.findIndex((p) => p.toLowerCase() === "include");

  if (includeIndex !== -1) {
    // Include 所在目录的父目录
    const parentDir = parts.slice(0, includeIndex).join(path.sep);
    // 尝试 Src 或 src
    const srcDirs = ["Src", "src"];
    for (const dir of srcDirs) {
      const candidate = path.join(parentDir, dir);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    }
    // 如果都不存在，返回 Include 同级目录
    return parentDir;
  } else {
    // headerPath 和 cppPath 在同一目录
    return path.dirname(headerPath);
  }
}

/**
 * 根据 headerPath 与 cppPath 生成合适的 include 语句。
 *
 * - 如果 headerPath 包含 include/Include → 使用 <...>
 * - 否则 → 使用相对于 cppPath 的相对路径，用 "..."
 */
export function makeIncludeLine(headerPath: string, cppPath: string): string {
  // 使用统一的斜杠以便正则匹配
  const normalizedHeader = headerPath.replace(/\\/g, "/");

  // 情况 1: 公共 include 目录
  const includeMatch = normalizedHeader.match(
    /(?:^|\/)(include|Include)\/(.+)$/
  );
  if (includeMatch) {
    // includeMatch[2] 是 include 之后的部分，例如 "foo/bar.h"
    return `#include <${includeMatch[2]}>`;
  }

  // 情况 2: 相对路径 include
  let relativePath = path.relative(path.dirname(cppPath), headerPath);
  // 转成 POSIX 风格路径 (避免 Windows 反斜杠)
  relativePath = relativePath.replace(/\\/g, "/");
  return `#include "${relativePath}"`;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "zpp.createCppFile",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const headerUri = editor.document.uri;
      const headerPath = headerUri.fsPath;

      // Only act on header files
      if (!headerPath.match(/\.(h|hpp|hh|hxx)$/)) {
        vscode.window.showWarningMessage("Current file is not a header file.");
        return;
      }

      const dir = path.dirname(headerPath);
      const base = path.basename(headerPath, path.extname(headerPath));
      const cppPath = path.join(getCppPath(headerPath), `${base}.cpp`);

      // Check if .cpp already exists
      if (fs.existsSync(cppPath)) {
        vscode.window.showInformationMessage(`${base}.cpp already exists.`);
        const doc = await vscode.workspace.openTextDocument(cppPath);
        vscode.window.showTextDocument(doc);
        return;
      }

      // ==== generate timestamp info ====
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const currentYear = now.getFullYear();
      const currentHour = pad(now.getHours());
      const currentMinute = pad(now.getMinutes());
      const currentSecond = pad(now.getSeconds());
      const currentDate = pad(now.getDate());
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const currentMonthName = monthNames[now.getMonth()];

      // ==== generate comment header ====
      const commentLines = [
        "/**",
        ` * Copyright © ${currentYear} Zen Shawn. All rights reserved.`,
        " * ",
        ` * @file ${path.basename(cppPath)}`,
        " * @author: Zen Shawn",
        " * @email: xiaozisheng2008@hotmail.com",
        ` * @date: ${currentHour}:${currentMinute}:${currentSecond}, ${currentMonthName} ${currentDate}, ${currentYear}`,
        " */",
        "",
        makeIncludeLine(headerPath, cppPath),
        "",
        "",
      ];

      const fileContent = commentLines.join("\n");
      fs.writeFileSync(cppPath, fileContent, { encoding: "utf8" });

      const doc = await vscode.workspace.openTextDocument(cppPath);
      vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(
        `Created ${base}.cpp with header comment.`
      );
    }
  );

  const setupProjectDisposable = vscode.commands.registerCommand(
    "zpp.setupCppProject",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open");
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;
      
      // Try to find res directory - could be in extension root or in out directory after packaging
      let resPath = path.join(context.extensionPath, "res");
      if (!fs.existsSync(resPath)) {
        resPath = path.join(context.extensionPath, "out", "res");
      }

      // If still not found, try relative path for development
      if (!fs.existsSync(resPath)) {
        resPath = path.join(__dirname, "..", "res");
      }

      if (!fs.existsSync(resPath)) {
        vscode.window.showErrorMessage("Resource files not found");
        return;
      }

      try {
        // Copy all configuration files from res to project root
        const filesToCopy = [
          ".clang-format",
          ".clang-tidy",
          ".clangd",
          ".gitignore"
        ];

        for (const file of filesToCopy) {
          const sourcePath = path.join(resPath, file);
          const targetPath = path.join(rootPath, file);

          // Check if file already exists
          if (fs.existsSync(targetPath)) {
            const overwrite = await vscode.window.showWarningMessage(
              `${file} already exists in project root. Overwrite?`,
              "Yes",
              "No"
            );
            
            if (overwrite !== "Yes") {
              continue;
            }
          }

          // Copy file
          fs.copyFileSync(sourcePath, targetPath);
        }

        vscode.window.showInformationMessage(
          "C++ project setup completed successfully!"
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to setup C++ project: ${error}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(setupProjectDisposable);
}

export function deactivate() {}
