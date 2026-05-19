import { execSync } from 'child_process';

export function updateSubmodules() {
  execSync('git submodule update --init --recursive', { stdio: 'inherit' });

  execSync('git submodule foreach git pull origin main', { stdio: 'inherit' });
}
