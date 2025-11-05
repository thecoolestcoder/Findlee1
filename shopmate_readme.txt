1. Open PowerShell as Administrator

2. Search for "PowerShell" in the Start menu, right-click, and select "Run as Administrator".​

3. Set Execution Policy for the Current User

	Run this command in the opened PowerShell window:

Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
When prompted, type Y and press Enter to confirm.​​

4. Try the npm Command Again

Now, you should be able to run npm commands in normal shell windows or even vscode terminals
5. run--- npm install in both frontend and backend. 
6. run --- npm run dev in both frontend and backend folder