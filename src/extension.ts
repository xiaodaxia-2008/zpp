import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "cppSourceGenerator.createCppFile",
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
      const cppPath = path.join(dir, `${base}.cpp`);

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
        `#include "${path.basename(headerPath)}"`,
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

  context.subscriptions.push(disposable);
}

export function deactivate() {}
