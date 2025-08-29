import { Component, signal } from '@angular/core';
import { CabbingoBoard } from "./components/cabbingo-board/cabbingo-board";

@Component({
  selector: 'app-root',
  imports: [CabbingoBoard],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('cabbingov2');
}
