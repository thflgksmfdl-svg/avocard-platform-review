import { NotImplementedError } from '../../shared/errors.js';
import type { ChannelTalkPort, SendNotificationInput, SendNotificationResult } from './channel-talk.port.js';

export class ChannelTalkStubAdapter implements ChannelTalkPort {
  async sendNotification(_input: SendNotificationInput): Promise<SendNotificationResult> {
    throw new NotImplementedError(
      'Channel Talk adapter is a stub. No live notification sending is implemented yet — ' +
        'see docs/agent-handoff/AVOCARD_AGENT_HANDOFF/04_API_INTEGRATION_SPEC.md §8 and item P1-17.',
    );
  }
}
