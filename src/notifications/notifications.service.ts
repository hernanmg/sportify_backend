import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class NotificationsService {
  private sns: AWS.SNS;

  constructor() {
    this.sns = new AWS.SNS({ region: 'us-east-1' });
  }

  async publish(topicArn: string, message: string): Promise<void> {
    try {
      await this.sns
        .publish({
          TopicArn: topicArn,
          Message: message,
        })
        .promise();
      console.log(`Message sent to topic ${topicArn}`);
    } catch (error) {
      console.error('Error publishing message:', error);
      throw error;
    }
  }
}
