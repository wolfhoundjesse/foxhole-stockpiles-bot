import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  MessageFlags,
  ButtonInteraction
} from 'discord.js';
import {
  Discord,
  Guard,
  Slash,
  SelectMenuComponent,
  ButtonComponent,
  ModalComponent
} from 'discordx';
import { Command } from '../models/constants';
import { PermissionGuard } from '../guards/PermissionGuard';
import { PostgresService } from '../services/postgres-service';

// IANA timezone identifiers - international standard
const TIMEZONE_REGIONS = {
  Africa: [
    'Africa/Cairo',
    'Africa/Casablanca',
    'Africa/Harare',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Nairobi'
  ],
  America: [
    'America/Anchorage',
    'America/Chicago',
    'America/Denver',
    'America/Edmonton',
    'America/Halifax',
    'America/Indiana/Indianapolis',
    'America/Juneau',
    'America/Los_Angeles',
    'America/Mexico_City',
    'America/New_York',
    'America/Phoenix',
    'America/Regina',
    'America/Sao_Paulo',
    'America/Toronto',
    'America/Vancouver',
    'America/Winnipeg'
  ],
  Asia: [
    'Asia/Bangkok',
    'Asia/Calcutta',
    'Asia/Dhaka',
    'Asia/Dubai',
    'Asia/Hong_Kong',
    'Asia/Irkutsk',
    'Asia/Jakarta',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Kuala_Lumpur',
    'Asia/Manila',
    'Asia/Seoul',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Asia/Taipei',
    'Asia/Tokyo',
    'Asia/Vladivostok'
  ],
  Australia: [
    'Australia/Adelaide',
    'Australia/Brisbane',
    'Australia/Darwin',
    'Australia/Hobart',
    'Australia/Melbourne',
    'Australia/Perth',
    'Australia/Sydney'
  ],
  Europe: [
    'Europe/Amsterdam',
    'Europe/Athens',
    'Europe/Belgrade',
    'Europe/Berlin',
    'Europe/Bratislava',
    'Europe/Brussels',
    'Europe/Bucharest',
    'Europe/Budapest',
    'Europe/Copenhagen',
    'Europe/Dublin',
    'Europe/Helsinki',
    'Europe/Istanbul',
    'Europe/Kiev',
    'Europe/Lisbon',
    'Europe/London',
    'Europe/Madrid',
    'Europe/Minsk',
    'Europe/Moscow',
    'Europe/Oslo',
    'Europe/Paris',
    'Europe/Prague',
    'Europe/Riga',
    'Europe/Rome',
    'Europe/Sofia',
    'Europe/Stockholm',
    'Europe/Tallinn',
    'Europe/Vienna',
    'Europe/Vilnius',
    'Europe/Warsaw',
    'Europe/Zurich'
  ],
  Pacific: [
    'Pacific/Auckland',
    'Pacific/Fiji',
    'Pacific/Guam',
    'Pacific/Honolulu',
    'Pacific/Majuro',
    'Pacific/Port_Moresby'
  ],
  UTC: ['UTC']
};

const TIMEZONE_IDS = {
  Search: 'search',
  'Select Region': 'region_select',
  Confirm: 'confirm',
  Cancel: 'cancel'
};

@Discord()
@Guard(PermissionGuard)
export class RegisterTimezoneCommand {
  private postgresService = new PostgresService();
  private userSelections: { [userId: string]: { timezone: string; displayName: string } } = {};

  @Slash({
    name: 'register-timezone',
    description: 'Register your timezone for timezone-based features'
  })
  async registerTimezone(interaction: CommandInteraction): Promise<void> {
    console.log('registerTimezone called'); // Debug log

    try {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('region_select')
        .setPlaceholder('Select your region')
        .addOptions([
          { label: 'America', value: 'America', description: 'North and South America' },
          { label: 'Europe', value: 'Europe', description: 'Europe' },
          { label: 'Asia', value: 'Asia', description: 'Asia' },
          { label: 'Australia', value: 'Australia', description: 'Australia' },
          { label: 'Africa', value: 'Africa', description: 'Africa' },
          { label: 'Pacific', value: 'Pacific', description: 'Pacific Islands' },
          { label: 'UTC', value: 'UTC', description: 'UTC' }
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: '**Timezone Registration**\n\nChoose your region:',
        components: [row],
        flags: MessageFlags.Ephemeral
      });

      console.log('registerTimezone reply sent'); // Debug log
    } catch (error) {
      console.error('Error in registerTimezone:', error);
      await interaction.reply({
        content: 'An error occurred while setting up the timezone registration. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @SelectMenuComponent({ id: 'region_select' })
  async handleRegionSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    console.log('handleRegionSelect called with:', interaction.values[0]); // Debug log

    try {
      const selectedRegion = interaction.values[0];

      const timezoneOptions = this.getTimezonesForRegion(selectedRegion);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('timezone_select')
        .setPlaceholder(`Select timezone in ${selectedRegion}`)
        .addOptions(timezoneOptions);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.update({
        content: `**Select Timezone in ${selectedRegion}**\n\nChoose your specific timezone:`,
        components: [row]
      });

      console.log('handleRegionSelect update sent'); // Debug log
    } catch (error) {
      console.error('Error in handleRegionSelect:', error);
      await interaction.reply({
        content: 'An error occurred while processing your region selection. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @SelectMenuComponent({ id: 'timezone_select' })
  async handleTimezoneSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    console.log('handleTimezoneSelect called with:', interaction.values[0]); // Debug log

    try {
      const selectedTimezone = interaction.values[0];
      const userId = interaction.user.id;

      // Save to database
      await this.postgresService.saveUserTimezone(userId, selectedTimezone);

      await interaction.update({
        content: `✅ **Timezone Registered Successfully!**\n\n**Timezone:** ${selectedTimezone}\n\nYou can now use timezone-based features.`,
        components: []
      });

      console.log('handleTimezoneSelect update sent'); // Debug log
    } catch (error) {
      console.error('Error in handleTimezoneSelect:', error);
      await interaction.reply({
        content: 'An error occurred while saving your timezone. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @ButtonComponent({ id: TIMEZONE_IDS['Search'] })
  async handleSearch(interaction: ButtonInteraction): Promise<void> {
    try {
      // Create a modal for timezone search
      const modal = new ModalBuilder()
        .setCustomId('timezone_search_modal')
        .setTitle('Search Timezone');

      const searchInput = new TextInputBuilder()
        .setCustomId('timezone_search')
        .setLabel('Search for your timezone')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., "New York", "London", "Tokyo", "UTC+5"')
        .setRequired(true)
        .setMaxLength(100);

      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(searchInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error in handleSearch:', error);
      await interaction.reply({
        content: 'An error occurred while opening the search modal. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @ModalComponent({ id: 'timezone_search_modal' })
  async handleSearchModal(interaction: ModalSubmitInteraction): Promise<void> {
    const searchTerm = interaction.fields.getTextInputValue('timezone_search').toLowerCase();

    // Search through all timezones
    const allTimezones = Object.values(TIMEZONE_REGIONS).flat();
    const matches = allTimezones
      .filter(
        tz =>
          tz.toLowerCase().includes(searchTerm) ||
          this.formatTimezoneLabel(tz).toLowerCase().includes(searchTerm)
      )
      .slice(0, 25); // Discord limit

    if (matches.length === 0) {
      await interaction.reply({
        content:
          'No timezones found matching your search. Try a different search term or use the region selection.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const timezoneOptions = matches.map(tz => ({
      label: this.formatTimezoneLabel(tz),
      value: tz,
      description: this.getTimezoneOffset(tz)
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('timezone_select')
      .setPlaceholder('Select from search results')
      .addOptions(timezoneOptions);

    const backButton = new ButtonBuilder()
      .setCustomId('back_to_regions')
      .setLabel('Back to Regions')
      .setStyle(ButtonStyle.Secondary);

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

    await interaction.reply({
      content: `**Search Results for "${searchTerm}"**\n\nFound ${matches.length} timezone(s):`,
      components: [row1, row2],
      flags: MessageFlags.Ephemeral
    });
  }

  @ButtonComponent({ id: 'custom_name' })
  async handleCustomName(interaction: ButtonInteraction): Promise<void> {
    try {
      const modal = new ModalBuilder()
        .setCustomId('custom_name_modal')
        .setTitle('Customize Display Name');

      const nameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Display Name (optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., "EST", "PST", "My Timezone"')
        .setRequired(false)
        .setMaxLength(50);

      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error in handleCustomName:', error);
      await interaction.reply({
        content: 'An error occurred while opening the custom name modal. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @ModalComponent({ id: 'custom_name_modal' })
  async handleCustomNameModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const displayName = interaction.fields.getTextInputValue('display_name');
      const userId = interaction.user.id;

      if (this.userSelections[userId]) {
        this.userSelections[userId].displayName =
          displayName || this.formatTimezoneLabel(this.userSelections[userId].timezone);
      }

      const confirmButton = new ButtonBuilder()
        .setCustomId(TIMEZONE_IDS['Confirm'])
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId(TIMEZONE_IDS['Cancel'])
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

      await interaction.reply({
        content: `**Confirm Timezone Registration**\n\n**Selected Timezone:** ${this.formatTimezoneLabel(this.userSelections[userId]?.timezone || '')}\n**Display Name:** ${this.userSelections[userId]?.displayName || 'Default'}\n**Current Time:** ${this.getCurrentTime(this.userSelections[userId]?.timezone || '')}\n\nClick "Confirm" to register your timezone.`,
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error in handleCustomNameModal:', error);
      await interaction.reply({
        content: 'An error occurred while processing your custom name. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @ButtonComponent({ id: TIMEZONE_IDS['Confirm'] })
  async handleConfirm(interaction: ButtonInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const selection = this.userSelections[userId];

      if (!selection) {
        await interaction.reply({
          content: 'No timezone selection found. Please start over.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Save to database
      await this.postgresService.saveUserTimezone(
        userId,
        selection.timezone,
        selection.displayName
      );

      // Clean up
      delete this.userSelections[userId];

      await interaction.update({
        content: `✅ **Timezone Registered Successfully!**\n\n**Timezone:** ${this.formatTimezoneLabel(selection.timezone)}\n**Display Name:** ${selection.displayName}\n**Current Time:** ${this.getCurrentTime(selection.timezone)}\n\nYou can now use timezone-based features.`,
        components: []
      });
    } catch (error) {
      console.error('Error in handleConfirm:', error);
      await interaction.reply({
        content: 'An error occurred while saving your timezone. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @ButtonComponent({ id: TIMEZONE_IDS['Cancel'] })
  async handleCancel(interaction: ButtonInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      delete this.userSelections[userId];

      await interaction.update({
        content: '❌ Timezone registration cancelled.',
        components: []
      });
    } catch (error) {
      console.error('Error in handleCancel:', error);
      await interaction.reply({
        content: 'An error occurred while cancelling. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @ButtonComponent({ id: 'back_to_regions' })
  async handleBackToRegions(interaction: ButtonInteraction): Promise<void> {
    try {
      // Recreate the original region selection interface
      const regionOptions = Object.keys(TIMEZONE_REGIONS).map(region => ({
        label: region,
        value: region,
        description: `${TIMEZONE_REGIONS[region as keyof typeof TIMEZONE_REGIONS].length} timezones available`
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(TIMEZONE_IDS['Select Region'])
        .setPlaceholder('Select your region')
        .addOptions(regionOptions);

      const searchButton = new ButtonBuilder()
        .setCustomId(TIMEZONE_IDS['Search'])
        .setLabel('Search Timezone')
        .setStyle(ButtonStyle.Primary);

      const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(searchButton);

      await interaction.update({
        content:
          '**Timezone Registration**\n\nChoose your region from the dropdown, or click "Search Timezone" to search for a specific timezone.',
        components: [row1, row2]
      });
    } catch (error) {
      console.error('Error in handleBackToRegions:', error);
      await interaction.reply({
        content: 'An error occurred while going back to regions. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  private formatTimezoneLabel(timezone: string): string {
    const parts = timezone.split('/');
    if (parts.length === 1) return timezone;

    const city = parts[parts.length - 1].replace(/_/g, ' ');
    const region = parts[0];
    return `${city} (${region})`;
  }

  private getTimezoneOffset(timezone: string): string {
    try {
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;

      // Get the time in the target timezone
      const targetTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const targetUtcTime = targetTime.getTime() + targetTime.getTimezoneOffset() * 60000;

      // Calculate the offset in hours
      const offsetHours = (targetUtcTime - utcTime) / (1000 * 60 * 60);
      const sign = offsetHours >= 0 ? '+' : '';

      return `UTC${sign}${Math.round(offsetHours)}`;
    } catch (error) {
      console.error('Error calculating timezone offset for', timezone, error);
      return 'UTC';
    }
  }

  private getCurrentTime(timezone: string): string {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'Unable to get current time';
    }
  }

  private getTimezonesForRegion(
    region: string
  ): Array<{ label: string; value: string; description: string }> {
    const timezones: { [key: string]: string[] } = {
      America: [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Toronto',
        'America/Vancouver',
        'America/Mexico_City'
      ],
      Europe: [
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Europe/Rome',
        'Europe/Moscow',
        'Europe/Amsterdam',
        'Europe/Dublin'
      ],
      Asia: [
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Asia/Singapore',
        'Asia/Seoul',
        'Asia/Bangkok',
        'Asia/Dubai',
        'Asia/Kolkata'
      ],
      Australia: [
        'Australia/Sydney',
        'Australia/Melbourne',
        'Australia/Brisbane',
        'Australia/Perth',
        'Australia/Adelaide'
      ],
      Africa: [
        'Africa/Cairo',
        'Africa/Johannesburg',
        'Africa/Lagos',
        'Africa/Nairobi',
        'Africa/Casablanca'
      ],
      Pacific: ['Pacific/Auckland', 'Pacific/Honolulu', 'Pacific/Fiji', 'Pacific/Guam'],
      UTC: ['UTC']
    };

    return (
      timezones[region]?.map(tz => ({
        label: tz
          .replace(/_/g, ' ')
          .replace('America/', '')
          .replace('Europe/', '')
          .replace('Asia/', '')
          .replace('Australia/', '')
          .replace('Africa/', '')
          .replace('Pacific/', ''),
        value: tz,
        description: `Timezone: ${tz}`
      })) || []
    );
  }
}
