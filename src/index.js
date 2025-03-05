const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ChannelType,
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonStyle,
    PermissionsBitField,
    Events,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    WebhookClient,
    MessageFlags,
    StringSelectMenuBuilder,
    ActivityType
} = require('discord.js');
const {
    UserStats,
    ClickStats,
    UserIds,
    Channels
} = require('./database');
const cron = require('node-cron');
require('dotenv').config();

const client = new Client({
    intents: [Object.keys(GatewayIntentBits)],
    partials: [Object.keys(Partials)]
})

const {
    TOKEN,
    CLIENT_ID,
    WEBHOOK_URL
} = process.env;

/**
 * U've Webhook
 */
const uve = new WebhookClient({
    url: WEBHOOK_URL
});

const state = {
    buttonPressed: false,
    uveUpdate: {},
    userIdsArray: []
};

const commands = [
    new SlashCommandBuilder()
    .setName('kickleaderboard')
    .setDescription('Display the kick leaderboard')
    .addStringOption(option =>
        option
        .setName('scope')
        .setDescription('Select the leaderboard scope')
        .setRequired(true)
        .addChoices({
            name: 'Global',
            value: 'global'
        }, {
            name: 'Server',
            value: 'server'
        }, )
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clickleaderboard')
    .setDescription('Display the button click leaderboard')
    .addStringOption(option =>
        option
        .setName('scope')
        .setDescription('Select the leaderboard scope')
        .setRequired(true)
        .addChoices({
            name: 'Global',
            value: 'global'
        }, {
            name: 'Server',
            value: 'server'
        }, )
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gkick')
    .setDescription('Kick one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
    .addStringOption(option =>
        option.setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to kick.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option.setName('global')
        .setDescription('Kick users from all servers the bot has access to.')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gban')
    .setDescription('Ban one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addStringOption(option =>
        option.setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to ban.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option.setName('global')
        .setDescription('Ban users from all servers the bot has access to.')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('bonk')
    .setDescription('Manage the bonk list')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addStringOption(option =>
        option.setName('action')
        .setDescription('Manage the bonk list (add or remove users)')
        .setRequired(true)
        .addChoices({
            name: 'add',
            value: 'add'
        }, {
            name: 'remove',
            value: 'remove'
        })
    )
    .addUserOption(option =>
        option.setName('user')
        .setDescription('User to bonk')
        .setRequired(true)
    )

    .toJSON(),

    new SlashCommandBuilder()
    .setName('bonkchannel')
    .setDescription('Manage the bonk-related updates channel')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addSubcommand(subcommand =>
        subcommand
        .setName('set')
        .setDescription('Set the channel for bonk-related updates')
        .addChannelOption(option =>
            option
            .setName('channel')
            .setDescription('The channel to send bonk-related updates to')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
        subcommand
        .setName('remove')
        .setDescription('Remove the bonk-related updates channel')
    )
    .toJSON(),
];


const rest = new REST({
    version: "10"
}).setToken(TOKEN);

(async () => {
    try {
        console.log("Refreshing application (/) commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands
        });
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error refreshing commands:", error);
    }
})();

client.once(Events.ClientReady, async () => {
    /**
     * Update bot's presence based on total bonk users across all guilds
     */
    const updateActivity = async () => {
        const totalUsers = Object.values(state.userIdsArray)
            .reduce((sum, users) => sum + users.length, 0);
        const status = totalUsers === 0 ?
            'No bonk users' :
            `${totalUsers} bonk users across servers`;

        client.user.setPresence({
            activities: [{
                name: status,
                type: ActivityType.Watching
            }],
            status: 'dnd',
        });
    };

    /**
     * Fetch bonk users for a specific guild
     */
    const fetchBonkUsers = async (guild) => {
        const userIds = await UserIds.find({
            guildId: guild.id
        }, 'userId');
        state.userIdsArray[guild.id] = userIds.map(user => user.userId);
    };
    /**
     * Initialize bonk data for all guilds and update activity
     */
    await Promise.all(client.guilds.cache.map(fetchBonkUsers));
    await updateActivity();
    setInterval(updateActivity, 10000);

    /**
     * Periodically send bonk-related updates using cron jobs
     */

    cron.schedule('*/10 * * * *', async () => {
        if (state.buttonPressed) return; // Avoid redundant updates

        await Promise.all(client.guilds.cache.map(async (guild) => {
            const channelData = await Channels.findOne({
                guildId: guild.id
            });
            const uveChannelId = channelData ? .channelId;
            if (!uveChannelId) return;

            const uveChannel = client.channels.cache.get(uveChannelId);
            if (!uveChannel) return;

            const members = await Promise.all(
                (state.userIdsArray[guild.id] || []).map(userId =>
                    guild.members.fetch(userId).catch(() => null)
                )
            );

            members.forEach(async (member, index) => {
                if (!member) return;

                const userId = state.userIdsArray[guild.id][index];
                const username = member.user.username;

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                    .setCustomId(`bonk_button_${guild.id}_${userId}`) // Use member ID dynamically
                    .setLabel(`Bonk ${username}`)
                    .setStyle(ButtonStyle.Danger)
                );

                const embed = new EmbedBuilder()
                    .setTitle('Bonk User')
                    .setDescription(`Press the button to bonk **${username}** in **${guild.name}**.`)
                    .setColor('Purple')
                    .setFooter({
                        text: `User ID: ${userId}`
                    })
                    .setTimestamp();

                const message = state.uveUpdate[userId];
                if (message) {
                    await message.edit({
                        embeds: [embed],
                        components: [row]
                    });
                } else {
                    state.uveUpdate[userId] = await uveChannel.send({
                        embeds: [embed],
                        components: [row]
                    });
                }
            });
        }));
    });
});

client.on(Events.GuildMemberAdd, async (member) => {
    const userId = member.id;

    try {
        const user = await UserIds.findOne({
            userId
        });

        if (user && user.roleIds) {
            const roleIds = user.roleIds;

            await Promise.all(
                roleIds.map(async (roleId) => {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.add(role);
                    }
                })
            );
        }

        if (state.userIdsArray.includes(member.id)) return;

    } catch (error) {
        console.error('Error assigning roles on member add:', error);
    }
});


client.on(Events.GuildMemberRemove, async (member) => {
    const {
        user,
        guild
    } = member;

    try {
        /**
         * Fetch the audit logs to check for kicks
         * and kick audit logs is <20>
         */
        const auditLogs = await guild.fetchAuditLogs({
            type: 20, // Log Kick
            limit: 1,
        });

        const logEntry = auditLogs.entries.first();

        if (logEntry && logEntry.target.id === user.id) {
            await UserStats.findOneAndUpdate({
                userId: user.id
            }, {
                $inc: {
                    kicks: 1
                }
            }, {
                upsert: true,
                new: true
            });

            /**
             * Prevent spamming the webhook when people
             * are getting kicked from the bonk list
             */
            if (state.userIdsArray.includes(member.id)) return;
        }
    } catch (error) {
        console.error('Error updating kick count or sending invite:', error);
    }
});


client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton()) return;

    if (interaction.isCommand()) {
        const {
            commandName: cmd,
            options
        } = interaction;

        switch (cmd) {
            case 'bonkchannel': {
                const action = options.getSubcommand();
                const guildId = interaction.guildId;

                try {
                    if (action === 'set') {
                        const channel = options.getChannel('channel');

                        if (!channel || channel.type !== ChannelType.GuildText) {
                            return interaction.reply({
                                content: 'Please specify a valid text channel.',
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        await Channels.findOneAndUpdate({
                            guildId
                        }, {
                            guildId,
                            channelId: channel.id
                        }, {
                            upsert: true,
                            new: true
                        });

                        return interaction.reply({
                            content: `Bonk updates will now be sent to <#${channel.id}>.`,
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    if (action === 'remove') {
                        const existingChannel = await Channels.findOne({
                            guildId
                        });

                        if (!existingChannel ? .channelId) {
                            return interaction.reply({
                                content: 'There is no bonk channel set to remove.',
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        await Channels.deleteOne({
                            guildId
                        });

                        return interaction.reply({
                            content: 'The bonk channel has been successfully removed.',
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    return interaction.reply({
                        content: 'Invalid action. Please use "set" or "remove."',
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (error) {
                    console.error(`Error in bonkchannel command: ${error.message}`);
                    return interaction.reply({
                        content: 'An error occurred while processing your request. Please try again later.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
            case 'kickleaderboard':
            case 'clickleaderboard': {
                const isKick = cmd === 'kickleaderboard';
                const statModel = isKick ? UserStats : ClickStats;
                const statType = isKick ? 'kicks' : 'clicks';

                const scope = interaction.options.getString('scope'); // 'global' or 'server'
                const isGlobal = scope === 'global';
                const query = isGlobal ? {} : {
                    guildId: interaction.guild.id
                };

                const topStats = await statModel.find(query)
                    .sort({
                        [statType]: -1
                    })
                    .limit(10);

                if (!topStats.length) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription(`No data available for the ${isKick ? 'kick' : 'click'} leaderboard.`)
                            .setColor('Purple'),
                        ],
                        ephemeral: true,
                    });
                }

                const rankIcons = ['🥇', '🥈', '🥉'];
                const leaderboard = await Promise.all(
                    topStats.map(async (user, index) => {
                        const rank = rankIcons[index] || `**${index + 1}.**`;
                        const fetchedUser = await interaction.client.users.fetch(user.userId).catch(() => null);
                        const username = fetchedUser ? fetchedUser.username : 'Unknown User';
                        return `${rank} **${username}** — **${statType.charAt(0).toUpperCase() + statType.slice(1)}:** ${user[statType]} (<@${user.userId}>)`;
                    })
                );

                const totalActions = topStats.reduce((sum, user) => sum + user[statType], 0);

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                        .setTitle(`🏆 ${isKick ? 'Kick' : 'Click'} Leaderboard (${isGlobal ? 'Global' : 'Server'})`)
                        .setColor(isKick ? 'Gold' : 'Green')
                        .setDescription(leaderboard.join('\n'))
                        .addFields({
                            name: `Total ${statType.charAt(0).toUpperCase() + statType.slice(1)}`,
                            value: `${totalActions}`,
                            inline: true,
                        })
                        .setFooter({
                            text: `${isKick ? 'Kick' : 'Click'} Leaderboard updated • ${new Date().toLocaleString()}`,
                            iconURL: interaction.guild.iconURL(),
                        }),
                    ],
                });
            }
            case 'gkick':
            case 'gban': {
                const users = options.getString("users");
                const globalAction = options.getBoolean("global");
                const userIds = users.split(',').map(id => id.trim().replace(/[<@!>]/g, ""));
                const action = cmd === 'gkick' ? 'kick' : 'ban';
                const actionVerb = cmd === 'gkick' ? 'kicked' : 'banned';

                /**
                 * Perform action on a specific user in a specific guild
                 */
                const performAction = async (guild, userId, action, actionVerb) => {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);

                        if (!member) {
                            if (action === "ban") {
                                await guild.members.ban(userId, {
                                    reason: `${actionVerb} by ${interaction.user.username}`
                                });
                                return `✅ Successfully ${actionVerb} user with ID \`${userId}\` from **${guild.name}**.`;
                            }
                            return `❌ User with ID \`${userId}\` not found in **${guild.name}**.`;
                        }

                        /**
                         * Permission and role hierarchy checks
                         */
                        if (action === "kick" && !member.kickable) {
                            return `❌ Cannot kick <@${userId}> from **${guild.name}** due to role hierarchy or permissions.`;
                        }
                        if (action === "ban" && !guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                            return `❌ Bot lacks permissions to ban members in **${guild.name}**.`;
                        }

                        /**
                         *  Perform the action (kick or ban)
                         */
                        await member[action]({
                            reason: `${actionVerb} by ${interaction.user.username}`
                        });
                        return `✅ Successfully ${actionVerb} <@${userId}> from **${guild.name}**.`;
                    } catch (error) {
                        return `❌ Failed to ${action} <@${userId}> from **${guild.name}** - ${error.message}`;
                    }
                };


                /**
                 * Process action across multiple guilds
                 */
                const processActionAcrossGuilds = async (guilds, userIds, action, actionVerb) => {
                    const results = [];
                    for (const guild of guilds) {
                        const guildResults = await Promise.all(
                            userIds.map(userId => performAction(guild, userId, action, actionVerb))
                        );
                        results.push(...guildResults);
                    }
                    return results;
                };

                if (globalAction) {
                    /** 
                     * Apply action globally across all guilds
                     */
                    const guilds = Array.from(client.guilds.cache.values());
                    const results = await processActionAcrossGuilds(guilds, userIds, action, actionVerb);
                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription(results.join("\n"))
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    /**
                     *  Prompt user to select specific guilds
                     */
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('guildSelect')
                        .setPlaceholder('Select the guild(s) to perform the action on.')
                        .setMinValues(1)
                        .setMaxValues(client.guilds.cache.size)
                        .addOptions(
                            client.guilds.cache.map(guild => ({
                                label: guild.name,
                                value: guild.id,
                            }))
                        );
                    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setColor('Purple')
                            .setTitle(`Select the guild(s) to ${action} the users in:`)
                            .setDescription('Use the dropdown menu below to select one or more guilds.')
                        ],
                        components: [actionRow],
                        flags: MessageFlags.Ephemeral,
                    });

                    const filter = i => i.customId === 'guildSelect' && i.user.id === interaction.user.id;
                    const collector = interaction.channel.createMessageComponentCollector({
                        filter,
                        time: 15000 // 15 seconds to choose
                    });

                    collector.on('collect', async i => {
                        const selectedGuildIds = i.values;
                        const selectedGuilds = selectedGuildIds.map(id => client.guilds.cache.get(id));

                        if (selectedGuilds.length === 0) {
                            return i.reply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setDescription('No guilds were selected, aborting action.')
                                    .setColor('Purple')
                                ],
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        const results = await processActionAcrossGuilds(selectedGuilds, userIds, action, actionVerb);
                        await i.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(results.join("\n"))
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    });

                    collector.on('end', async collected => {
                        if (collected.size === 0) {
                            const disabledSelectMenu = selectMenu.setDisabled(true);
                            const disabledActionRow = new ActionRowBuilder().addComponents(disabledSelectMenu);
                            await interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setColor('Purple')
                                    .setTitle('No selection made. Action aborted.')
                                ],
                                components: [disabledActionRow],
                            });
                        }
                    });
                }
            }
            case "bonk": {
                const action = options.getString('action');
                const user = options.getUser('user');

                if (!action || !user) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription('Please provide both the action (`add` or `remove`) and the user.')
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const userId = user.id;
                const guildId = interaction.guild.id;

                if (action === 'add') {
                    try {
                        const member = interaction.guild.members.cache.get(userId) || await interaction.guild.members.fetch(userId).catch(() => null);
                        if (!member) {
                            return interaction.reply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setDescription(`The user ${user.username} is not a member of this server and cannot be added to the "bonk" list.`)
                                    .setColor('Purple')
                                ],
                                flags: MessageFlags.Ephemeral,
                            });
                        }
                        /**
                         * Check if the user already exists in the bonk list for this guild
                         */
                        const existingUser = await UserIds.findOne({
                            guildId,
                            userId
                        });
                        if (existingUser) {
                            return interaction.reply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setDescription(`User ${user.username} is already in the "bonk" list for this server.`)
                                    .setColor('Purple')
                                ],
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        const roleIds = member.roles.cache
                            .filter(role => role.id !== member.guild.id) // Exclude @everyone role
                            .map(role => role.id);

                        await UserIds.create({
                            guildId,
                            userId,
                            roleIds
                        });


                        state.userIdsArray[guildId] = state.userIdsArray[guildId] || [];
                        state.userIdsArray[guildId].push({
                            userId,
                            roleIds
                        });

                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`User ${user.username} has been successfully added to the "bonk" list for this server.`)
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    } catch (error) {
                        console.error(`Error adding user to bonk list: ${error}`);
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription('An error occurred while adding the user to the bonk list.')
                                .setColor('Red')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                } else if (action === 'remove') {
                    try {
                        const result = await UserIds.deleteOne({
                            guildId,
                            userId
                        });
                        if (result.deletedCount === 0) {
                            return interaction.reply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setDescription(`User ${user.username} was not found in the "bonk" list for this server.`)
                                    .setColor('Purple')
                                ],
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        if (state.userIdsArray[guildId]) {
                            state.userIdsArray[guildId] = state.userIdsArray[guildId].filter(entry => entry.userId !== userId);
                        }

                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`User ${user.username} has been successfully removed from the "bonk" list for this server.`)
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    } catch (error) {
                        console.error(`Error removing user from bonk list: ${error}`);
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription('An error occurred while removing the user from the bonk list.')
                                .setColor('Red')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                }
            }
        }
    } else if (interaction.isButton()) {
        const [, , guildId, targetUserId] = interaction.customId.split('_');
        const {
            id: userId,
            username
        } = interaction.user;

        /**
         * Prevent self-bonking
         */
        if (userId === targetUserId) {
            return interaction.reply({
                content: "You can't bonk yourself!",
                flags: MessageFlags.Ephemeral,
            });
        }

        /**
         * Prevent bonk users from pressing the button
         */
        const guildUserIdsArray = state.userIdsArray[guildId] || []; // Get the state for this guild
        if (guildUserIdsArray.some(entry => entry.userId === userId)) {
            return interaction.reply({
                content: "You are not allowed to interact with this button!",
                flags: MessageFlags.Ephemeral,
            });
        }

        /**
         * Log the button click via webhook
         */
        await uve.send({
            embeds: [
                new EmbedBuilder()
                .setDescription(`Button clicked by user: ${username} (ID: ${userId}) in guild ${interaction.guild.name}`)
                .setColor('Purple'),
            ],
        });

        /**
         * Check if the target user is in the guild
         */
        const tMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (!tMember) {
            return interaction.reply({
                content: "The user is not in the guild.",
                flags: MessageFlags.Ephemeral,
            });
        }

        /**
         * Update the click stats in the database (scoped to the guild)
         */
        await ClickStats.findOneAndUpdate({
            guildId,
            userId
        }, {
            $inc: {
                clicks: 1
            }
        }, {
            upsert: true,
            new: true,
        });


        /**
         * Attempt to kick the target user and respond
         */
        try {
            await interaction.guild.members.kick(targetUserId, `Kicked by ${username}`);

            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                    .setDescription(`${tMember.user.username} has been bonked out of the guild!`)
                    .setColor('Purple'),
                ],
                components: [], // Remove the button
            });
        } catch (error) {
            console.error(`Failed to kick user ${targetUserId} in guild ${guildId}:`, error);
            return interaction.reply({
                content: "An error occurred while trying to kick the user.",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});


client.login(TOKEN);
