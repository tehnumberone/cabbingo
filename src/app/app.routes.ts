import { Routes } from '@angular/router';
import { CabbingoEditBoard } from './components/cabbingo-edit-board/cabbingo-edit-board';
import { CabbingoBoard } from './components/cabbingo-board/cabbingo-board';
import { CabbingoLogin } from './components/cabbingo-login/cabbingo-login';
import { CabbingoBoards } from './components/cabbingo-boards/cabbingo-boards';
import { CabbingoBoardEditor } from './components/cabbingo-board-editor/cabbingo-board-editor';
import { AdminImages } from './components/admin-images/admin-images';

export const routes: Routes = [
    { path: 'edit-board', component: CabbingoEditBoard },
    { path: 'login', component: CabbingoLogin },
    { path: 'board', component: CabbingoBoard },
    { path: 'manage-board', component: CabbingoBoardEditor },
    { path: 'admin/images', component: AdminImages },
    { path: '', component: CabbingoBoards },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
