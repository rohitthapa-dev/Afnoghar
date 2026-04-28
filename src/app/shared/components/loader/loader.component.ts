import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss',
})
export class LoaderComponent {
  @Input() diameter = 48;
  @Input() color: 'primary' | 'accent' | 'warn' = 'primary';
  @Input() loading = true;
  @Input() fullscreen = false;
  @Input() message = '';
}
