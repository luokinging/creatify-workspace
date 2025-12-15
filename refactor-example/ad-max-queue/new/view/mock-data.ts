import type { AnalysisQueueItem, AutomationStatus, CreationQueueItem, KnowledgeBase, WeeklyCycle } from '../../type';
import {
  AdSetStatus,
  AutomationLevel,
  CreativeStatus,
  CyclePhase,
  ImpactLevel,
  RecommendationType,
  RuleStatus,
} from '../../type';

export const mockAutomationStatus: AutomationStatus = {
  level: AutomationLevel.SUPERVISED,
  currentWeek: 3,
  weeksInCurrentLevel: 3,
  approvalRate: 62,
  confidence: 75,
  canUpgrade: false,
  nextLevelRequirements: 'Reach 70%+ approval rate for 2 more weeks',
  circuitBreakers: [
    {
      id: 'cb-1',
      name: 'CPA Deviation',
      metric: 'CPA',
      threshold: '>50% above target',
      action: 'pause_all',
      enabled: true,
      triggered: false,
    },
    {
      id: 'cb-2',
      name: 'Spend Anomaly',
      metric: 'Daily Spend',
      threshold: '>3x daily budget',
      action: 'notify',
      enabled: true,
      triggered: false,
    },
  ],
};

export const mockWeeklyCycle: WeeklyCycle = {
  currentWeek: 3,
  cyclePhase: CyclePhase.CREATION,
  creationPipelineActive: true,
  analysisPipelineActive: false,
  nextCycleStart: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
};

export const mockCreationQueue: CreationQueueItem[] = [
  {
    id: 'cq-1',
    adSet: {
      id: 'as-1',
      name: 'Summer Collection 2024',
      videos: [
        {
          id: 'v1',
          thumbnailUrl: '/placeholder-video-1.jpg',
          videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/ig_media_18017107736772842.mp4',
          duration: 15,
          status: CreativeStatus.PENDING,
        },
        {
          id: 'v2',
          thumbnailUrl: '/placeholder-video-2.jpg',
          videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/2080346882501228.mp4',
          duration: 12,
          status: CreativeStatus.PENDING,
        },
        {
          id: 'v3',
          thumbnailUrl: '/placeholder-video-3.jpg',
          videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/2264894850648421.mp4',
          duration: 18,
          status: CreativeStatus.PENDING,
        },
      ],
      targeting: {
        ageRange: 'Women 25-34',
        interests: ['Fashion & Beauty'],
      },
      dailyBudget: 200,
      status: AdSetStatus.PENDING_APPROVAL,
      week: 3,
    },
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    timeout: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
  },
  {
    id: 'cq-2',
    adSet: {
      id: 'as-2',
      name: 'Back to School Promo',
      videos: [
        {
          id: 'v4',
          thumbnailUrl: '/placeholder-video-4.jpg',
          videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/750776854411881.mp4',
          duration: 10,
          status: CreativeStatus.PENDING,
        },
        {
          id: 'v5',
          thumbnailUrl: '/placeholder-video-5.jpg',
          videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/ig_media_18017107736772842.mp4',
          duration: 16,
          status: CreativeStatus.PENDING,
        },
      ],
      targeting: {
        ageRange: 'Women 25-44',
        interests: ['Education', 'Parenting'],
      },
      dailyBudget: 150,
      status: AdSetStatus.PENDING_APPROVAL,
      week: 3,
    },
    submittedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    timeout: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
  },
];

export const mockAnalysisQueue: AnalysisQueueItem[] = [
  {
    id: 'aq-1',
    recommendation: {
      id: 'br-1',
      type: RecommendationType.PROMOTE_TO_SCALE,
      adId: '2847',
      adName: 'Summer Sale',
      campaignId: 'c-1',
      campaignName: 'Scaling Campaign',
      video: {
        id: 'v-a1',
        thumbnailUrl: '/placeholder-video-1.jpg',
        videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/ig_media_18017107736772842.mp4',
        duration: 15,
        status: CreativeStatus.APPROVED,
      },
      metrics: {
        ctr: 0.032,
        cpa: 18,
        roas: 4.2,
        spend: 1200,
        impressions: 50000,
        clicks: 1600,
        conversions: 66,
      },
      action: {
        type: 'increase_budget',
        currentValue: 300,
        newValue: 800,
        delta: 500,
        deltaPercent: 166.67,
        description: 'Increase budget by $500/day',
        reasoning:
          'Consistently high ROAS (4.2x) and CTR above target. Strong performance indicates opportunity to scale.',
      },
      impact: ImpactLevel.HIGH,
      week: 2, // Week N-1 (analyzing previous week's data)
      requiresApproval: true,
    },
    submittedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    timeout: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
  },
  {
    id: 'aq-2',
    recommendation: {
      id: 'br-2',
      type: RecommendationType.TURN_OFF,
      adId: '2851',
      adName: 'Holiday Special',
      campaignId: 'c-2',
      campaignName: 'Testing Campaign',
      video: {
        id: 'v-a2',
        thumbnailUrl: '/placeholder-video-2.jpg',
        videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/2080346882501228.mp4',
        duration: 12,
        status: CreativeStatus.APPROVED,
      },
      metrics: {
        ctr: 0.004,
        cpa: 127,
        roas: 0.8,
        spend: 850,
        impressions: 180000,
        clicks: 720,
        conversions: 6,
      },
      action: {
        type: 'pause',
        currentValue: 150,
        newValue: 0,
        delta: -150,
        deltaPercent: -100,
        description: 'Pause campaign to stop losses',
        reasoning:
          'CPA significantly above target ($50) and ROAS below break-even. Poor performance across all metrics.',
      },
      impact: ImpactLevel.MEDIUM,
      week: 2,
      requiresApproval: true,
    },
    submittedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
    timeout: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
  },
  {
    id: 'aq-3',
    recommendation: {
      id: 'br-3',
      type: RecommendationType.ADD_BUDGET,
      adId: '2855',
      adName: 'Spring Collection',
      campaignId: 'c-1',
      campaignName: 'Scaling Campaign',
      video: {
        id: 'v-a3',
        thumbnailUrl: '/placeholder-video-3.jpg',
        videoUrl: 'https://d35ghwdno3nak3.cloudfront.net/user/8412/meta_ad_video/2264894850648421.mp4',
        duration: 18,
        status: CreativeStatus.APPROVED,
      },
      metrics: {
        ctr: 0.018,
        cpa: 35,
        roas: 2.8,
        spend: 600,
        impressions: 42000,
        clicks: 756,
        conversions: 17,
      },
      action: {
        type: 'increase_budget',
        currentValue: 100,
        newValue: 180,
        delta: 80,
        deltaPercent: 80,
        description: 'Increase budget by $80/day',
        reasoning: 'Solid performance with room for growth. Moderate ROAS suggests opportunity for scaling.',
      },
      impact: ImpactLevel.HIGH, // >50% change requires approval in supervised mode
      week: 2,
      requiresApproval: true,
    },
    submittedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    timeout: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
  },
];

export const mockKnowledgeBase: KnowledgeBase = {
  lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  approvalCount: 147,
  rejectionCount: 38,
  creativePatterns: [
    {
      id: 'cp-1',
      pattern: 'Close-up product shots',
      impact: 'CTR +40%',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'cp-2',
      pattern: 'Background music vs silent',
      impact: '+25% engagement',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'cp-3',
      pattern: 'Optimal video length: 15-20s',
      impact: 'Best ROAS',
      status: RuleStatus.NEEDS_REVIEW,
    },
    {
      id: 'cp-4',
      pattern: 'Bold text overlays in first 3s',
      impact: 'Hook rate +35%',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'cp-5',
      pattern: 'User testimonials format',
      impact: 'Conversion +18%',
      status: RuleStatus.NEEDS_REVIEW,
    },
    {
      id: 'cp-6',
      pattern: 'Fast-paced editing',
      impact: 'Attention retention +22%',
      status: RuleStatus.DECLINED,
    },
  ],
  targetingRules: [
    {
      id: 'tr-1',
      rule: 'Women 25-44 (primary segment)',
      effectiveness: 'Highest ROAS',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'tr-2',
      rule: 'Interest: Fashion & Beauty',
      effectiveness: 'Core audience',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'tr-3',
      rule: 'Exclude: Competitor brand engagers',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'tr-4',
      rule: 'Lookalike: Top 2% purchasers',
      effectiveness: 'Scale audience',
      status: RuleStatus.NEEDS_REVIEW,
    },
    {
      id: 'tr-5',
      rule: 'Geographic: Urban metro areas',
      status: RuleStatus.NEEDS_REVIEW,
    },
    {
      id: 'tr-6',
      rule: 'Age: 18-24 (testing segment)',
      effectiveness: 'Experimental',
      status: RuleStatus.DECLINED,
    },
  ],
  performanceThresholds: [
    {
      id: 'pt-1',
      metric: 'Max CPA',
      threshold: '$50',
      action: 'Pause trigger',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'pt-2',
      metric: 'Min CTR',
      threshold: '0.5%',
      action: 'Scale threshold',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'pt-3',
      metric: 'ROAS target',
      threshold: '3.0x minimum',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'pt-4',
      metric: 'Daily budget cap',
      threshold: '$10,000',
      action: 'Risk limit',
      status: RuleStatus.APPROVED,
    },
    {
      id: 'pt-5',
      metric: 'Min conversions for scale',
      threshold: '50 conversions/week',
      action: 'Statistical significance',
      status: RuleStatus.NEEDS_REVIEW,
    },
    {
      id: 'pt-6',
      metric: 'Max spend per day',
      threshold: '$10,000',
      action: 'Risk limit',
      status: RuleStatus.APPROVED,
    },
  ],
};
