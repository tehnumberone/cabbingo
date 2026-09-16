import { Routes } from '@angular/router';
import { CabbingoEditBoard } from './components/cabbingo-edit-board/cabbingo-edit-board';
import { CabbingoBoard } from './components/cabbingo-board/cabbingo-board';
import { CabbingoLogin } from './components/cabbingo-login/cabbingo-login';

export const routes: Routes = [
    { path: 'edit-board', component: CabbingoEditBoard },
    { path: 'login', component: CabbingoLogin },
    { path: '', component: CabbingoBoard },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
