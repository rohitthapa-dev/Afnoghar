import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AiBuyerService } from '../../../core/services/ai-buyer.service';
import { AuthService } from '../../../core/services/auth.service';
import { Property } from '../../../core/models/property.model';
import { PriceFormatPipe } from '../../pipes/price-format.pipe';

type ChatMessage = {
  role: 'assistant' | 'user';
  text: string;
};

@Component({
  selector: 'app-ai-chat-widget',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PriceFormatPipe,
  ],
  templateUrl: './ai-chat-widget.component.html',
  styleUrl: './ai-chat-widget.component.scss',
})
export class AiChatWidgetComponent {
  private aiBuyerService = inject(AiBuyerService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  @ViewChild('messageLog') private messageLog?: ElementRef<HTMLDivElement>;

  isOpen = false;
  isLoading = false;
  message = '';
  recommendedProperties: Property[] = [];
  messages: ChatMessage[] = [
    {
      role: 'assistant',
      text: 'Hi, I am AfnoGhar Chat. How can I help you find a property today?',
    },
  ];

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      queueMicrotask(() => this.scrollToLatest());
    }
  }

  closeChat(): void {
    this.isOpen = false;
  }

  askAI(): void {
    const trimmedMessage = this.message.trim();
    if (!trimmedMessage || this.isLoading) return;

    if (!this.isLoggedIn) {
      this.messages.push({
        role: 'assistant',
        text: 'Please log in to use AfnoGhar Chat.',
      });
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      this.scrollToLatestSoon();
      return;
    }

    this.messages.push({ role: 'user', text: trimmedMessage });
    this.message = '';
    this.isLoading = true;
    this.scrollToLatestSoon();

    this.aiBuyerService
      .ask(trimmedMessage)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.scrollToLatestSoon();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.recommendedProperties = res.properties || [];
          this.messages.push({
            role: 'assistant',
            text: res.reply || 'Here are the closest matches I found.',
          });
        },
        error: () => {
          this.recommendedProperties = [];
          this.messages.push({
            role: 'assistant',
            text: 'AI search is unavailable right now. Please try again in a moment.',
          });
        },
      });
  }

  private scrollToLatestSoon(): void {
    setTimeout(() => this.scrollToLatest());
  }

  private scrollToLatest(): void {
    const element = this.messageLog?.nativeElement;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }
}
