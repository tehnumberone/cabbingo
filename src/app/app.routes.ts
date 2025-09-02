import { Routes } from '@angular/router';
import { CabbingoEditBoard } from './components/cabbingo-edit-board/cabbingo-edit-board';
import { CabbingoBoard } from './components/cabbingo-board/cabbingo-board';

export const routes: Routes = [
    { path: 'edit-board', component: CabbingoEditBoard , redirectTo: '/edit-board', pathMatch: 'full' },
    { path: 'board', component: CabbingoBoard, redirectTo: '/board', pathMatch: 'full' },
    { path: '**', redirectTo: '/board', pathMatch: 'full' }
];
