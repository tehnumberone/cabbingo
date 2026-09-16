import { Routes } from '@angular/router';
import { CabbingoEditBoard } from './components/cabbingo-edit-board/cabbingo-edit-board';
import { CabbingoBoard } from './components/cabbingo-board/cabbingo-board';
import { CabbingoLogin } from './components/cabbingo-login/cabbingo-login';
import { CabbingoBoards } from './components/cabbingo-boards/cabbingo-boards';
import { CabbingoBoardEditor } from './components/cabbingo-board-editor/cabbingo-board-editor';

export const routes: Routes = [
    { path: 'edit-board', component: CabbingoEditBoard },
    { path: 'login', component: CabbingoLogin },
    { path: 'board', component: CabbingoBoard },
    { path: 'manage-board', component: CabbingoBoardEditor },
    { path: '', component: CabbingoBoards },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
