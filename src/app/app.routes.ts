import { Routes } from '@angular/router';
import { CabbingoEditBoard } from './components/cabbingo-edit-board/cabbingo-edit-board';
import { CabbingoBoard } from './components/cabbingo-board/cabbingo-board';

export const routes: Routes = [
    { path: 'edit-board', component: CabbingoEditBoard },
    { path: '', component: CabbingoBoard },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
