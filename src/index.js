/**
 * The Purpose of this project was to bully snow.
 * it's all creative idea's i've made all store into 1 file,
 * this is the first time i've make a src like this. 
 * so it may be messey with everything all over the place
 * 
 * Made By Avieah
 * Date: 1/3/25
 */

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonStyle,
    PermissionsBitField,
    Events,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    WebhookClient,
    MessageFlags
} = require('discord.js');
const {
    UserStats,
    ClickStats
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
    TARGET_USER_IDS,
    CHANNEL_ID,
    WEBHOOK_URL
} = process.env;

const uve = new WebhookClient({
    url: WEBHOOK_URL
});

const userIdsArray = TARGET_USER_IDS.split(',');

const state = {
    buttonPressed: false,
    uveUpdate: {}
};

const commands = [
    new SlashCommandBuilder()
    .setName('kickleaderboard')
    .setDescription('Display the kick leaderboard')
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clickleaderboard')
    .setDescription('Display the button click leaderboard')
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clearmsgs')
    .setDescription('Clear a number of messages from a specific user')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user whose messages to delete')
        .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a role from a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user to remove the role from')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role')
        .setDescription('The role to remove from the user')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('Assign a role to a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user to assign the role to')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role')
        .setDescription('The role to assign to the user')
        .setRequired(true)
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

client.once(Events.ClientReady, () => {
    console.log(`${client.user.username} is online in ${client.guilds.cache.size} guild(s).`);

    // Schedule the task to run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        if (state.buttonPressed) return;

        try {
            const guild = client.guilds.cache.first();
            const uveChannel = client.channels.cache.get(CHANNEL_ID);

            for (const userId of userIdsArray) {
                // Check if the user is in the server
                const member = await guild.members.fetch(userId).catch(() => null);

                if (member) {
                    const username = member.user.username;

                    // Creates the button
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                        .setCustomId(`kick_button_${userId}`)
                        .setLabel(`Bonk ${username}`)
                        .setStyle(ButtonStyle.Danger)
                    );

                    const embed = new EmbedBuilder()
                        .setDescription(`Press the button to bonk ${username}`)
                        .setColor('Purple');

                    /**
                     * If the original message is there, we just update it,
                     * but if we restart the bot, a new message gets sent
                     */
                    if (state.uveUpdate[userId]) {
                        await state.uveUpdate[userId].edit({
                            embeds: [embed],
                            components: [row]
                        });
                    } else {
                        state.uveUpdate[userId] = await uveChannel.send({
                            embeds: [embed],
                            components: [row]
                        });
                    }
                }
            }
        } catch (error) {
            console.error('An error occurred:', error);
        }
    });
});

client.on(Events.GuildMemberAdd, async (member) => {
    const userRoleMap = {
        "487060202621894657": "1210482229340274689", // "SNOW" : 'HEADMOD
        "1108162232774299729": "1308540258778091650" // "DUMBASS" : "SERVER RETARD"
    };

    const roleId = userRoleMap[member.id];
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);

        try {
            // Assign the role based on the role map
            await member.roles.add(role);
        } catch (error) {
            console.error('Failed to assign role:', error);
        }
    }

    // slap it down here so we can still role the users.
    if (userIdsArray.includes(member.id)) return;
    uve.send({
        embeds: [
            new EmbedBuilder()
            .setDescription(`${member.user.username} has joined the server.`)
            .setColor('Purple')
        ]
    })
});

client.on(Events.GuildMemberRemove, async (member) => {
    if (userIdsArray.includes(member.id)) return; // ingore the users that are in bonk

    uve.send({
        embeds: [
            new EmbedBuilder()
            .setDescription(`${member.user.username} has left the server.`)
            .setColor('Purple')
        ]
    })
})

client.on(Events.GuildMemberRemove, async (member) => {
    const {
        user,
        guild
    } = member;

    try {
        // Fetch the audit logs to check for kicks
        const auditLogs = await guild.fetchAuditLogs({
            type: 20, // 20 is the audit log type for kicks
            limit: 1
        });

        const logEntry = auditLogs.entries.first();
        if (logEntry && logEntry.target.id === user.id) {
            console.log(`User ${user.username} was kicked from ${guild.name}`);

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
             * unfortunately, can't use this code because for some reason dms are still turned off makes no sense.
             */

            // we create the invite for snow, beause this mf keeps getting kicked HEHE
            // const invite = await guild.invites.create(guild.channels.cache.first(), {
            //     maxUses: 1,
            //     unique: true
            // });
            // console.log(`Invite created for ${user.username}: ${invite.url}`);

            // // send this mf a invite using his Id (i got lazy on sending him)
            // const uve = await client.users.fetch(TARGET_USER_ID)
            // try {
            //     await uve.send(`You have been re-invited to the server: ${invite.url}`);
            // } catch (dmError) {
            //     console.error(`Could not send DM to ${user.username}:`, dmError);
            // }
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

        /**
         * pretty self explainatory our commands.
         */
        switch (cmd) {
            case 'kickleaderboard':
            case 'clickleaderboard': {
                try {
                    const isKick = cmd === 'kickleaderboard';
                    const topStats = isKick ?
                        await UserStats.find({}).sort({
                            kicks: -1
                        }).limit(10) :
                        await ClickStats.find({}).sort({
                            clicks: -1
                        }).limit(10);

                    if (!topStats.length) {
                        return interaction.reply({
                            content: `No data available for the ${isKick ? 'kick' : 'click'} leaderboard.`,
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    const rankIcons = ['🥇', '🥈', '🥉'];
                    const leaderboard = topStats
                        .map((user, index) => `${rankIcons[index] || `**${index + 1}.**`} <@${user.userId}> — **${isKick ? 'Kicks' : 'Clicks'}:** ${isKick ? user.kicks : user.clicks}`)
                        .join('\n');
                    const totalActions = topStats.reduce((sum, user) => sum + (isKick ? user.kicks : user.clicks), 0);

                    const embed = new EmbedBuilder()
                        .setTitle(`🏆 ${isKick ? 'Kick' : 'Click'} Leaderboard`)
                        .setColor(isKick ? 'Red' : 'Blue')
                        .setDescription(leaderboard)
                        .addFields({
                            name: `Total ${isKick ? 'Kicks' : 'Clicks'}`,
                            value: `${totalActions}`,
                            inline: true
                        })
                        .setFooter({
                            text: `${isKick ? 'Kick' : 'Click'} Leaderboard updated • ${new Date().toLocaleString()}`,
                            iconURL: interaction.guild.iconURL()
                        });

                    await interaction.reply({
                        embeds: [embed],
                        //flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error(`Error fetching ${cmd} leaderboard:`, error);
                    await interaction.reply({
                        content: `An error occurred while fetching the ${cmd === 'kickleaderboard' ? 'kick' : 'click'} leaderboard.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                break;
            }
            case 'clearmsgs': {
                const user = options.getUser('user');
                const amount = options.getInteger('amount');

                // Validate the amount of messages to delete
                if (amount < 1 || amount > 100) {
                    return interaction.reply({
                        content: 'Please specify a valid number of messages to delete (1-100).',
                        flags: MessageFlags.Ephemeral,
                    });
                }

                try {
                    const messages = await interaction.channel.messages.fetch({
                        limit: 100
                    });
                    const userMessages = messages.filter(msg => msg.author.id === user.id).first(amount);

                    // Check if there are any messages to delete
                    if (!userMessages.length) {
                        return interaction.reply({
                            content: `No messages found from <@${user.id}>.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.channel.bulkDelete(userMessages, true);
                    return interaction.reply({
                        content: `Cleared ${userMessages.length} messages from <@${user.id}>.`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Error clearing messages:', error);
                    interaction.reply({
                        content: 'There was an error processing your request.',
                        flags: MessageFlags.Ephemeral
                    });
                }
                break;
            }
            case 'addrole':
            case 'removerole': {
                const roleUser = options.getUser('user');
                const role = options.getRole('role');
                const member = await interaction.guild.members.fetch(roleUser.id);

                if (!member) {
                    return interaction.reply({
                        content: 'User not found in this server.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({
                        content: `I cannot manage the role ${role.name} because it is higher than or equal to my highest role.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                try {
                    const action = cmd === 'addrole' ? 'add' : 'remove';
                    const hasRole = member.roles.cache.has(role.id);
                    const actionVerb = cmd === 'addrole' ? 'assigned' : 'removed';
                    const alreadyHasRole = action === 'add' && hasRole;
                    const doesNotHaveRole = action === 'remove' && !hasRole;

                    if (alreadyHasRole || doesNotHaveRole) {
                        return interaction.reply({
                            content: `The user ${alreadyHasRole ? 'already has' : 'does not have'} the role ${role.name}.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await member.roles[action](role);
                    interaction.reply({
                        content: `Successfully ${actionVerb} the role ${role.name} to ${roleUser.username}.`,
                        ephemeral: false,
                    });
                } catch (error) {
                    console.error(`Error managing role:`, error);
                    interaction.reply({
                        content: `There was an error while trying to manage the role.`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                break;
            }
            case 'gkick':
            case 'gban': {
                const users = options.getString("users");
                const globalAction = options.getBoolean("global");
                const userIdsOrMentions = users.split(',').map(id => id.trim().replace(/[<@!>]/g, ""));
                const action = cmd === 'gkick' ? 'kick' : 'ban';
                const actionVerb = cmd === 'gkick' ? 'kicked' : 'banned';
                const results = [];

                const performAction = async (guild, userId) => {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (!member) {
                            return `❌ User with ID \`${userId}\` could not be found in **${guild.name}**.`;
                        }
                        if (action === "kick" && !member.kickable) {
                            return `❌ Cannot kick <@${userId}> from **${guild.name}** due to role hierarchy or permissions.`;
                        }
                        if (action === "ban" && !guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                            return `❌ Bot lacks permissions to ban members in **${guild.name}**.`;
                        }
                        await member[action]({
                            reason: `${actionVerb} by ${interaction.user.username}`
                        });
                        return `✅ Successfully ${actionVerb} <@${userId}> from **${guild.name}**.`;
                    } catch (error) {
                        return `❌ Failed to ${action} <@${userId}> from **${guild.name}** - ${error.message}`;
                    }
                };

                if (globalAction) {
                    for (const guild of client.guilds.cache.values()) {
                        for (const userId of userIdsOrMentions) {
                            results.push(await performAction(guild, userId));
                        }
                    }
                } else {
                    if (!interaction.guild) {
                        return interaction.reply({
                            content: "This command can only be used in a server.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const permissionCheck = action === "kick" ? PermissionsBitField.Flags.KickMembers : PermissionsBitField.Flags.BanMembers;
                    if (!interaction.member.permissions.has(permissionCheck)) {
                        return interaction.reply({
                            content: `You lack the required permissions to ${action} members.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    for (const userId of userIdsOrMentions) {
                        results.push(await performAction(interaction.guild, userId));
                    }
                }

                await interaction.reply({
                    content: results.join("\n"),
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

        }
    } else {
        for (const targetUserId of userIdsArray) {
            if (interaction.customId === `kick_button_${targetUserId}`) {
                const {
                    id: userId,
                    username
                } = interaction.user;

                // Ignore the users trying to kick themselves
                if (userId === targetUserId) {
                    return interaction.reply({
                        content: "You can't bonk yourself!",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                // Prevent users from kicking themselves or specific users
                if (userIdsArray.includes(userId)) {
                    return interaction.reply({
                        content: "You are not allowed to use this button!",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                // Check if the target user is in the guild
                const tMember = interaction.guild.members.cache.get(targetUserId);
                if (!tMember) {
                    return interaction.reply({
                        content: "The user is not in the guild.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await ClickStats.findOneAndUpdate({
                    userId
                }, {
                    $inc: {
                        clicks: 1
                    }
                }, {
                    upsert: true,
                    new: true
                });

                uve.send({
                    embeds: [
                        new EmbedBuilder()
                        .setDescription(`Button clicked by user: ${username} (ID: ${userId})`)
                        .setColor('Purple'),
                    ],
                });

                // Kick the user
                await tMember.kick(`We Kicked ${tMember.user.username} HEHE`);

                const sEmbed = new EmbedBuilder()
                    .setDescription(`${tMember.user.username} has been kicked.`)
                    .setColor('Purple');

                return await interaction.update({
                    embeds: [sEmbed],
                    components: [],
                });
            }
        }
    }
});



client.login(TOKEN);
